import { mkdir, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import {replaceFile} from './atomic-file.mjs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSession, updateDraft, updateRoster, applyCharacter, assignCharacter, recordExchange, cancelPending, validateSession, normaliseDraft, isId, SessionError, SCHEMA_VERSION } from '../shared/session-domain.mjs';
import { createCharacterLibrary } from './character-library.mjs';
import { createSessionAI } from './session-ai.mjs';
import { changeSetup } from '../shared/setup-domain.mjs';
import { extractContext } from './context-extract.mjs';
import {createDiscussionService} from './discussion-service.mjs';

const fail = (message, status = 400, code) => { throw new SessionError(message, status, code); };
const identifier = value => { if (!isId(value)) fail('Invalid profile, session, or request identifier.'); return value.toLowerCase(); };
const json = (res, status, data) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(data));
const keys = (input, allowed) => { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('Unexpected request fields.'); };
async function body(req, limit = 65536) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') fail('Use application/json.', 415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) fail('This request is too large.', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Invalid JSON.'); }
}
function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  try { const origin = new URL(req.headers.origin); return ['http:', 'https:'].includes(origin.protocol) && origin.host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

// The session AI runtime is independent of the retired coding/preview services.
export function createSessionService({ root, ai = createSessionAI(), onError = () => {} }) {
  const characters = createCharacterLibrary({ root });
  const inflight = new Map(), avatarResults = new Map();
  const store = path.resolve(root, '.sovereign', 'sessions', 'v1');
  const locks = new Map();
  async function serial(key, operation) {
    const previous = locks.get(key) || Promise.resolve();
    const work = previous.catch(() => {}).then(operation);
    locks.set(key, work);
    try { return await work; } finally { if (locks.get(key) === work) locks.delete(key); }
  }
  async function directory(profileId, create = false) {
    // Check each dedicated directory before use so a junction cannot redirect writes into old data.
    const parts = [path.resolve(root), path.resolve(root, '.sovereign'), path.resolve(root, '.sovereign', 'sessions'), store, path.join(store, profileId)];
    for (const part of parts) {
      try { const info = await lstat(part); if (info.isSymbolicLink() || !info.isDirectory()) fail('Session storage is unavailable. Existing data has not been changed.', 409, 'STORAGE_CONFLICT'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!create) return null;
        try { await mkdir(part); } catch (creationError) {
          if (creationError.code !== 'EEXIST') throw creationError;
          const info = await lstat(part); if (info.isSymbolicLink() || !info.isDirectory()) fail('Session storage is unavailable.', 409, 'STORAGE_CONFLICT');
        }
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
  async function persist(saved) {
    validateSession(saved);
    const content = JSON.stringify(saved, null, 2);
    if (Buffer.byteLength(content) > 8_000_000) fail('This session has reached its storage limit. Save your next situation as a new session.', 413, 'SESSION_LIMIT');
    const folder = await directory(saved.profileId, true);
    const target = path.join(folder, `${saved.id}.json`);
    const temporary = path.join(folder, `${saved.id}.${randomUUID()}.tmp`);
    await writeFile(temporary, content, { flag: 'wx' });
    await replaceFile(temporary, target);
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
  const discussions=createDiscussionService({ai,characters,load,persist,serial,inflight,json,fail});
  return {
    async handle(req, res, url) {
      try {
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Use the session service from this application.' });
        if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'sessions', schemaVersion: SCHEMA_VERSION, previewEnabled: false, inferenceEnabled: true });
        if (url.pathname === '/api/session-capabilities' && req.method === 'GET') return json(res, 200, { schemaVersion: SCHEMA_VERSION, modes: ['discussion', 'rehearsal'], draftSessions: true, characters: true, guide: true, guidedSetup:true, contextReview:true, tutorialProgress:true, liveSessions: true, discussion:true,liveRehearsal:false, modelRouting: true, voice: true, legacyData: 'preserved' });
        if (url.pathname === '/api/ai/catalog' && req.method === 'GET') return json(res, 200, await ai.catalog());
        const discussionRoute=/^\/api\/discussion\/([0-9a-f-]+)\/(control|turn|brief|cast)$/.exec(url.pathname);
        if(discussionRoute){
          if(req.method!=='POST'||!sameOrigin(req))return json(res,403,{error:'Use discussion controls from this application.'});
          const profileId=identifier(url.searchParams.get('profileId')),id=identifier(discussionRoute[1]),input=await body(req),part=discussionRoute[2];
          keys(input,part==='control'?['requestId','expectedRevision','operation','action','text','characterId','style']:['requestId','expectedRevision']);
          return await discussions.handle(req,res,{profileId,id,part,input,requestId:identifier(input.requestId)});
        }
        if(url.pathname==='/api/context/extract'){
          if(req.method!=='POST'||!sameOrigin(req))return json(res,403,{error:'Use context review from this application.'});
          identifier(url.searchParams.get('profileId'));
          return json(res,200,{item:await extractContext(await body(req,2_800_000))});
        }
        if(url.pathname==='/api/guidance/progress'){
          if(req.method!=='POST'||!sameOrigin(req))return json(res,403,{error:'Use guide lessons from this application.'});
          return json(res,200,await characters.progress(identifier(url.searchParams.get('profileId')),await body(req)));
        }
        if (url.pathname.startsWith('/api/ai/')) {
          if (req.method !== 'POST') return json(res,405,{ error:'Use a supported AI action.' });
          if (!sameOrigin(req)) return json(res,403,{ error:'AI actions require a same-origin request.' });
          const profileId = identifier(url.searchParams.get('profileId')), input = await body(req, url.pathname === '/api/ai/transcribe' ? 7_000_000 : 32768);
          const controller = new AbortController(), disconnect = () => { if (!res.writableEnded) controller.abort(); };
          res.once('close', disconnect);
          try {
            if(url.pathname==='/api/ai/narrate'){
              keys(input,['text','sessionId']);if(typeof input.text!=='string'||!input.text.trim()||input.text.length>2500)fail('Use a short guide caption.');
              const library=await characters.get(profileId),snapshot=input.sessionId?await load(profileId,identifier(input.sessionId)):null;
              const guide=snapshot?.guidance?.guide||library.characters.find(c=>c.id===library.guideId);
              if(!guide?.voice)fail('Choose a guide voice first. Captions remain available.',503);
              return json(res,200,await ai.speak(profileId,guide,input.text,controller.signal));
            }
            if(url.pathname==='/api/ai/setup'){
              keys(input,['sessionId','requestId','expectedRevision']);const id=identifier(input.sessionId),requestId=identifier(input.requestId),key=profileId+'/'+id;
              const snapshot=await serial(key,async()=>{const s=await load(profileId,id);if(!s)fail('Session not found.',404);return s;});
              const prior=snapshot.events.find(e=>e.requestId===requestId);
              if(prior){if(prior.type!=='session.guidance'||JSON.parse(prior.command).operation!=='propose')fail('Request identifier already used.',409);return json(res,200,{session:snapshot,replayed:true});}
              if(snapshot.revision!==input.expectedRevision)fail('The session changed. Reload before preparing the readback.',409);
              if(!snapshot.guidance?.guide?.brain?.model)fail('Choose a connected guide brain first. Your notes are kept.',503);
              if(!snapshot.guidance?.notes.some(n=>n.source==='user'))fail('Describe your situation first.');
              if(snapshot.guidance.notes.filter(n=>n.source==='interpretation').length>=15)fail('This session has reached its setup proposal limit.',429);
              if(inflight.has(key))fail('Interrupt the current reply before preparing setup.',409);
              inflight.set(key,controller);
              try{
                const result=await ai.setup(profileId,snapshot.guidance.guide,snapshot,controller.signal);
                if(controller.signal.aborted)fail('Setup interrupted.',409);
                const session=await serial(key,async()=>{const s=await load(profileId,id);const updated=changeSetup(s,{requestId,expectedRevision:input.expectedRevision,operation:'propose',payload:result});await persist(updated);return updated;});
                return json(res,200,{session});
              }finally{if(inflight.get(key)===controller)inflight.delete(key);}
            }
            if (url.pathname === '/api/ai/avatar') {
              keys(input,['requestId','description','brain']); identifier(input.requestId);
              if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 2000) fail('Describe your character in a short sentence.');
              const key = profileId + '/' + input.requestId, signature = JSON.stringify(input), previous = avatarResults.get(key);
              if (previous && previous.signature !== signature) fail('This request identifier was used for a different description.',409);
              if (previous) return json(res,200,await previous.promise);
              const promise = ai.avatar(profileId,input.description,input.brain,controller.signal);
              avatarResults.set(key,{signature,promise}); if (avatarResults.size > 100) avatarResults.delete(avatarResults.keys().next().value);
              try { return json(res,200,await promise); } catch(error) { avatarResults.delete(key); throw error; }
            }
            if (url.pathname === '/api/ai/transcribe') {
              keys(input,['audio','mime']);
              if (!['audio/webm','audio/mp4','audio/wav','audio/ogg','audio/mpeg'].includes(input.mime) || typeof input.audio !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(input.audio)) fail('Use a supported audio recording.');
              const audio = Buffer.from(input.audio,'base64'); if (!audio.length || audio.length > 5_000_000) fail('The recording is too large.',413);
              return json(res,200,await ai.transcribe(profileId,audio,input.mime,controller.signal));
            }
            if (url.pathname === '/api/ai/preview') {
              keys(input,['voice','voicePreference']);
              return json(res,200,await ai.speak(profileId,{voice:input.voice,voicePreference:input.voicePreference},'Hello. Let’s make room for another perspective.',controller.signal));
            }
            keys(input, url.pathname === '/api/ai/assign' ? ['sessionId','requestId','expectedRevision','characterId','brain','voice'] : ['sessionId','requestId','expectedRevision','characterId','text','exchangeId','contributionId']);
            const id = identifier(input.sessionId), requestId = identifier(input.requestId), characterId = identifier(input.characterId), key = profileId + '/' + id;
            const snapshot = await serial(key, async () => { const value = await load(profileId,id); if (!value) fail('No session was found in this profile.',404); return value; });
            const participant = snapshot.participants.find(p => p.active && p.characterId === characterId);
            const character = snapshot.guidance?.guide?.id === characterId ? snapshot.guidance.guide : participant && snapshot.characters.find(c => c.id === characterId);
            if (!character) fail('Choose a character in this room.',404);
            if (url.pathname === '/api/ai/speech') {
              const exchange = snapshot.exchanges?.find(e => e.id === input.exchangeId && e.characterId === characterId);
              if(input.exchangeId&&!exchange)fail('That reply does not belong to this character in this session.',404);
              const contribution=input.contributionId?snapshot.contributions.find(c=>c.id===input.contributionId&&c.participantId===participant?.id):null;
              if(input.contributionId&&!contribution)fail('That contribution does not belong to this speaker.',404);
              const text = contribution?.text||exchange?.text || `Hello, I’m ${character.name}. ${character.code}`;
              return json(res,200,await ai.speak(profileId,character,text,controller.signal));
            }
            if (url.pathname === '/api/ai/assign') {
              if (inflight.has(key)) fail('Interrupt the current reply before changing a brain.',409);
              await ai.validateAssignment(input.brain,input.voice);
              const session = await serial(key,async () => { const saved = await load(profileId,id); const updated = assignCharacter(saved,{...input,requestId,characterId}); if (updated !== saved) await persist(updated); return updated; });
              return json(res,200,{session});
            }
            if (url.pathname !== '/api/ai/talk') fail('Unsupported AI action.',404);
            if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) fail('Enter a short message.');
            const command = JSON.stringify({action:'talk',characterId,text:input.text});
            const previous = snapshot.events.find(e => e.requestId === requestId);
            if (previous) { if (previous.command !== command) fail('This request was already used for a different message.',409); return json(res,200,{session:snapshot,replayed:true}); }
            if (snapshot.revision !== input.expectedRevision) fail('The session changed. Reload it before sending again.',409);
            if ((snapshot.exchanges?.length || 0) >= 30) fail('This session has reached its 30-reply limit.',429);
            if (inflight.has(key)) fail('One character already has the floor. Interrupt or wait.',409);
            inflight.set(key,controller);
            try {
              const reply = await ai.talk(profileId,character,snapshot,input.text,controller.signal);
              if (controller.signal.aborted) fail('Reply interrupted.',409);
              const session = await serial(key, async () => { const saved = await load(profileId,id); const updated = recordExchange(saved,{requestId,expectedRevision:input.expectedRevision,characterId,userText:input.text,text:reply.text,brain:reply.brain,epoch:snapshot.epoch}); await persist(updated); return updated; });
              return json(res,200,{session});
            } finally { if (inflight.get(key) === controller) inflight.delete(key); }
          } finally { res.removeListener('close',disconnect); }
        }
        if (url.pathname === '/api/characters') {
          const profileId = identifier(url.searchParams.get('profileId'));
          if (req.method === 'GET') return json(res, 200, { library: await characters.get(profileId) });
          if (req.method !== 'POST') return json(res, 405, { error: 'Unsupported character operation.' });
          if (!sameOrigin(req)) return json(res, 403, { error: 'Character changes require a same-origin request.' });
          const input = await body(req);
          if (input.assignment) await ai.validateAssignment(input.assignment.brain,input.assignment.voice);
          return json(res, 200, await characters.mutate(profileId, input));
        }
        if (!url.pathname.startsWith('/api/sessions')) return json(res, 404, { error: 'This route is not part of the session service.' });
        const match = /^\/api\/sessions(?:\/([0-9a-f-]+))?$/.exec(url.pathname);
        if (!match) return json(res, 404, { error: 'Unknown session route.' });
        const profileId = identifier(url.searchParams.get('profileId'));
        const id = match[1] ? identifier(match[1]) : null;
        if (req.method === 'GET') {
          if (!id) return json(res, 200, await list(profileId));
          const saved = await load(profileId, id);
          return saved ? json(res, 200, { session: saved }) : json(res, 404, { error: 'No session was found in this profile.', code: 'SESSION_NOT_FOUND' });
        }
        if (!['POST', 'PATCH'].includes(req.method) || req.method === 'POST' && id || req.method === 'PATCH' && !id) return json(res, 405, { error: 'Unsupported session operation.' });
        if (!sameOrigin(req)) return json(res, 403, { error: 'Session changes require a same-origin request.' });
        const input = await body(req);
        if (req.method === 'POST') {
          keys(input, ['id', 'requestId', 'draft']);
          const sessionId = identifier(input.id), requestId = identifier(input.requestId), draft = normaliseDraft(input.draft);
          return await serial(`${profileId}/${sessionId}`, async () => {
            const existing = await load(profileId, sessionId);
            if (existing) {
              const original = existing.events[0];
              if (original.requestId !== requestId || original.command !== JSON.stringify({ action: 'create', draft })) fail('A different session already uses this identifier.', 409, 'REQUEST_CONFLICT');
              return json(res, 200, { session: existing, replayed: true });
            }
            const library = await characters.get(profileId);
            const saved = createSession({ id: sessionId, profileId, requestId, draft, guide: library.characters.find(item => item.id === library.guideId) });
            await persist(saved); return json(res, 201, { session: saved });
          });
        }
        keys(input, input?.action==='guidance'?['requestId','expectedRevision','action','operation','payload']:input?.action === 'apply-character' ? ['requestId','expectedRevision','action','characterId'] : input?.action === 'roster' ? ['requestId', 'expectedRevision', 'action', 'entries'] : ['requestId', 'expectedRevision', 'action', 'draft']);
        const requestId = identifier(input.requestId);
        if(input.action==='guidance'&&input.operation==='propose')fail('Guide proposals are prepared through the model route.',403);
        if (!['update', 'cancel', 'roster','apply-character','guidance'].includes(input.action)) fail('This session action is not available.');
        if (input.action === 'cancel' && input.draft !== undefined) fail('Cancellation does not edit a draft.');
        return await serial(`${profileId}/${id}`, async () => {
          const saved = await load(profileId, id);
          if (!saved) return json(res, 404, { error: 'No session was found in this profile.', code: 'SESSION_NOT_FOUND' });
          const mutation = { requestId, expectedRevision: input.expectedRevision, draft: input.draft, entries: input.entries };
          if (input.action === 'cancel') inflight.get(`${profileId}/${id}`)?.abort();
          const library = ['roster','apply-character'].includes(input.action) ? await characters.get(profileId) : null;
          const source=input.action==='apply-character'?library.characters.find(c=>c.id===input.characterId):null;
          if(input.action==='apply-character'&&!source)fail('Choose a saved character from this profile.',404);
          const updated = input.action==='guidance'?changeSetup(saved,{...mutation,operation:input.operation,payload:input.payload}):source ? applyCharacter(saved,mutation,source) : library ? updateRoster(saved, { ...mutation, guide: library.characters.find(item => item.id === library.guideId) }, library.characters) : input.action === 'update' ? updateDraft(saved, mutation) : cancelPending(saved, mutation);
          if (updated !== saved) await persist(updated);
          return json(res, 200, { session: updated, replayed: updated === saved });
        });
      } catch (error) {
        if(!(error instanceof SessionError))onError(error);
        json(res, error instanceof SessionError ? error.status : 500, { error: error instanceof SessionError ? error.message : 'The session could not be saved or loaded. Your existing data has been kept.', code: error instanceof SessionError ? error.code : 'STORAGE_ERROR' });
      }
    },
  };
}
