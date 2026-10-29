import {readFile, readdir, lstat} from 'node:fs/promises';
import path from 'node:path';
import {validateSession, isId, SessionError, SCHEMA_VERSION} from '../shared/session-domain.mjs';
import {createCharacterLibrary} from './character-library.mjs';
import {createSessionAI} from './session-ai.mjs';
import {createStudioService} from './studio-service.mjs';

const fail = (message, status = 400, code) => { throw new SessionError(message, status, code); };
const identifier = value => { if (!isId(value)) fail('Invalid profile or session identifier.'); return value.toLowerCase(); };
const json = (res, status, data) => res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}).end(JSON.stringify(data));

// Keep the public server/fixture entry point; legacy records are read-only.
export function createSessionService({root, ai = createSessionAI(), onError = () => {}, studioSpeech}) {
  const characters = createCharacterLibrary({root});
  const store = path.resolve(root, '.sovereign', 'sessions', 'v1');
  async function directory(profileId) {
    // Refuse redirected directories before reading preserved legacy records.
    const parts = [path.resolve(root), path.resolve(root, '.sovereign'), path.resolve(root, '.sovereign', 'sessions'), store, path.join(store, profileId)];
    for (const part of parts) {
      try { const info = await lstat(part); if (info.isSymbolicLink() || !info.isDirectory()) fail('Session storage is unavailable. Existing data has not been changed.', 409, 'STORAGE_CONFLICT'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return null;
      }
    }
    return parts.at(-1);
  }
  async function load(profileId, id) {
    const folder = await directory(profileId);
    if (!folder) return null;
    const file = path.join(folder, `${id}.json`);
    let raw;
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 8_000_000) fail('This saved session cannot be read safely. It has not been changed.', 409, 'INVALID_SAVED_SESSION');
      raw = await readFile(file, 'utf8');
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    let saved;
    try { saved = JSON.parse(raw); } catch { fail('This saved session contains invalid JSON. It has not been changed.', 409, 'INVALID_SAVED_SESSION'); }
    try { validateSession(saved); } catch (error) { if (error.code === 'UNSUPPORTED_SCHEMA') throw error; fail('This saved session is inconsistent. It has not been changed.', 409, 'INVALID_SAVED_SESSION'); }
    if (saved.profileId !== profileId || saved.id !== id) fail('Saved session identity does not match its location.', 409, 'INVALID_SAVED_SESSION');
    return saved;
  }
  async function list(profileId) {
    const folder = await directory(profileId);
    if (!folder) return { sessions: [], unavailableCount: 0 };
    const sessions = []; let unavailableCount = 0;
    const files = (await readdir(folder)).filter(file => /^[0-9a-f-]{36}\.json$/.test(file)).slice(0, 1000);
    for (const file of files) {
      try {
        const saved = await load(profileId, file.slice(0, -5));
        if (saved) sessions.push({ id: saved.id, title: saved.title, mode: saved.scenario.mode, status: saved.status, revision: saved.revision, updatedAt: saved.updatedAt });
      } catch (error) { if (error instanceof SessionError) unavailableCount++; else throw error; }
    }
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { sessions, unavailableCount };
  }
  const studio = createStudioService({root, characters, loadLegacySession: load, ai, onError, speech: studioSpeech});
  return {
    async handle(req, res, url) {
      if (url.pathname.startsWith('/api/studio/')) return studio.handle(req, res, url);
      try {
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, {error: 'Use the Studio service from this application.'});
        if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, {ok: true, service: 'studio', schemaVersion: SCHEMA_VERSION, studio: true, previewEnabled: false, inferenceEnabled: true});
        if (url.pathname === '/api/session-capabilities' && req.method === 'GET') return json(res, 200, {schemaVersion: SCHEMA_VERSION, studio: true, modelRouting: true, voice: true, legacyData: 'preserved', legacySessions: 'read-only'});
        if (url.pathname === '/api/ai/catalog' && req.method === 'GET') return json(res, 200, await ai.catalog());
        const match = /^\/api\/sessions(?:\/([0-9a-f-]+))?$/.exec(url.pathname);
        if (!match || req.method !== 'GET') return json(res, 404, {error: 'This route is not part of the Studio service.'});
        const profileId = identifier(url.searchParams.get('profileId'));
        if (!match[1]) return json(res, 200, await list(profileId));
        const saved = await load(profileId, identifier(match[1]));
        return saved ? json(res, 200, {session: saved}) : json(res, 404, {error: 'No saved session was found in this profile.', code: 'SESSION_NOT_FOUND'});
      } catch (error) {
        if (!(error instanceof SessionError)) onError(error);
        return json(res, error instanceof SessionError ? error.status : 500, {error: error instanceof SessionError ? error.message : 'The saved session could not be loaded. Your existing data has been kept.', code: error instanceof SessionError ? error.code : 'STORAGE_ERROR'});
      }
    },
  };
}
