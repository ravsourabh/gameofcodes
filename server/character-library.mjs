import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import {replaceFile} from './atomic-file.mjs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRecord, isId, SessionError } from '../shared/session-domain.mjs';
import { generateCharacter, characterFields, newGuideProgress, validateLibrary, LESSON_IDS } from '../shared/character-domain.mjs';

const fail = (message, status = 400, code) => { throw new SessionError(message, status, code); };
export function createCharacterLibrary({ root }) {
  const locks = new Map();
  async function serial(profileId, operation) {
    const work = (locks.get(profileId) || Promise.resolve()).catch(() => {}).then(operation); locks.set(profileId, work);
    try { return await work; } finally { if (locks.get(profileId) === work) locks.delete(profileId); }
  }
  async function location(profileId) {
    if (!isId(profileId)) fail('Invalid character profile.');
    const folders = [path.resolve(root), path.resolve(root, '.sovereign'), path.resolve(root, '.sovereign', 'characters'), path.resolve(root, '.sovereign', 'characters', 'v1'), path.resolve(root, '.sovereign', 'characters', 'v1', profileId)];
    for (const folder of folders) {
      try { await mkdir(folder); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      const info = await lstat(folder);
      if (!info.isDirectory() || info.isSymbolicLink()) fail('Character storage is unavailable. Existing data has been kept.', 409, 'STORAGE_CONFLICT');
    }
    return path.join(folders.at(-1), 'library.json');
  }
  async function persist(file, library) {
    validateLibrary(library);
    const data = JSON.stringify(library, null, 2);
    if (Buffer.byteLength(data) > 8_000_000) fail('The character library has reached its storage limit.', 413);
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, data, { flag: 'wx' }); await replaceFile(temporary, file);
  }
  async function load(profileId) {
    const file = await location(profileId);
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 8_000_000) fail('This library cannot be read safely. It has not been changed.', 409);
      let library;
      try { library = JSON.parse(await readFile(file, 'utf8')); } catch { fail('The saved character library is unreadable. It has not been changed.', 409); }
      try { validateLibrary(library); } catch (error) { if (error.code === 'UNSUPPORTED_SCHEMA') throw error; fail('The saved character library is inconsistent. It has not been changed.', 409); }
      if (library.profileId !== profileId) fail('Library profile does not match its storage.', 409);
      return { file, library };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const guide = generateCharacter(profileId, { seed: 72, guide: true });
    const library = { schemaVersion: 1, kind: 'character-library', profileId, revision: 1, updatedAt: new Date().toISOString(), guideId: guide.id, characters: [guide], guideProgress: newGuideProgress(profileId, guide.id), events: [{ requestId: randomUUID(), revision: 1, command: 'bootstrap-guide' }] };
    await persist(file, library); return { file, library };
  }
  return {
    get: profileId => serial(profileId, async () => (await load(profileId)).library),
    progress: (profileId,input) => serial(profileId,async()=>{
      const {file,library}=await load(profileId);
      if(!input || Object.keys(input).some(k=>!['requestId','expectedRevision','lesson','status','evidence'].includes(k)) || !isId(input.requestId) || !LESSON_IDS.includes(input.lesson) || !['active','completed','skipped'].includes(input.status))fail('Invalid lesson change.');
      const evidence={welcome:['continue'],selection:['selected-guide'],input:['confirmed-notes'],interruption:['interrupted','gave-floor'],brains:['opened-brain'],scoring:['rated-contribution'],presenters:['called-presenter'],rehearsal:['answered-panel']};
      if(input.status==='completed'&&!evidence[input.lesson].includes(input.evidence))fail('Complete the lesson action or explicitly skip it.');
      const command=JSON.stringify({lesson:input.lesson,status:input.status,evidence:input.evidence||null}),prior=library.events.find(e=>e.requestId===input.requestId);
      if(prior){if(prior.command!==command)fail('Lesson request already used.',409);return {library,replayed:true};}
      if(input.expectedRevision!==library.revision)fail('Reload guide progress before trying again.',409,'REVISION_CONFLICT');
      if(library.events.length>=1000)fail('The guide progress change limit has been reached.');
      const next=structuredClone(library);next.guideProgress.activeLesson=input.status==='active'?input.lesson:null;
      if(input.status!=='active')next.guideProgress.lessons[input.lesson]=input.status;
      next.revision++;next.updatedAt=new Date().toISOString();next.events.push({requestId:input.requestId,revision:next.revision,command});await persist(file,next);return {library:next,replayed:false};
    }),
    mutate: (profileId, input) => serial(profileId, async () => {
      const { file, library } = await load(profileId);
      if (!input || !isId(input.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !['create', 'update', 'guide'].includes(input.action)) fail('Invalid character operation.');
      if (Object.keys(input).some(key => !['requestId', 'expectedRevision', 'action', 'id', 'character', 'assignment'].includes(key)) || !isId(input.id)) fail('Unexpected character operation fields.');
      const fields = input.action === 'guide' ? null : characterFields(input.character);
      if (input.action === 'guide' && input.character !== undefined) fail('Guide selection does not edit character identity.');
      if (input.assignment && (input.action === 'guide' || Object.keys(input.assignment).some(key => !['brain','voice'].includes(key)))) fail('Unexpected assignment fields.');
      const command = JSON.stringify({ action: input.action, id: input.id, fields, ...(input.assignment ? { assignment: input.assignment } : {}) });
      const prior = library.events.find(item => item.requestId === input.requestId);
      if (prior) {
        if (prior.command !== command) fail('This request identifier was already used for a different character change.', 409);
        return { library, replayed: true };
      }
      if (input.expectedRevision !== library.revision) fail('The library changed in another tab. Reload the saved characters before trying again.', 409, 'REVISION_CONFLICT');
      if (library.events.length >= 1000) fail('The character library has reached its change limit.');
      const current = library.characters.find(item => item.id === input.id);
      const next = structuredClone(library), now = new Date().toISOString();
      if (input.action === 'create') {
        if (current) fail('This character identifier is already saved.', 409);
        if (library.characters.length >= 100) fail('This profile can save up to 100 characters.');
        next.characters.push(createRecord('character', profileId, { ...fields, voice: null, brain: null, ...input.assignment }, { id: input.id, now }));
      } else {
        if (!current) fail('No character was found in this profile.', 404);
        if (input.action === 'guide') { next.guideId = current.id; next.guideProgress.guideId = current.id; }
        else Object.assign(next.characters.find(item => item.id === current.id), fields, input.assignment, { updatedAt: now });
      }
      next.revision++; next.updatedAt = now;
      next.events.push({ requestId: input.requestId, revision: next.revision, command });
      await persist(file, next); return { library: next, replayed: false };
    }),
  };
}
