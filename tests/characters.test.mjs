import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateCharacter, appearanceFromSeed, rerollAppearance, characterFields, validateAppearance } from '../shared/character-domain.mjs';
import { createSessionService } from '../server/sessions.mjs';
import {modelForAppearance,AVATAR_MODELS} from '../shared/avatar-catalog.mjs';

test('reserved people are never generated and appended models keep older characters\' faces', () => {
 const reserved=new Set(AVATAR_MODELS.filter(m=>m.reserved).map(m=>m.id)),original=AVATAR_MODELS.slice(0,6).map(m=>m.id);
 assert.ok(reserved.size>0);
 for(let seed=0;seed<400;seed++){
  const generated=appearanceFromSeed(seed);assert.ok(!reserved.has(generated.realistic.modelId));
  assert.ok(!reserved.has(rerollAppearance(generated,[],seed+1,'model').realistic.modelId));
  assert.equal(modelForAppearance({seed,attributes:generated.attributes}),original[seed%6]);
 }
});

test('appearance generation is deterministic and partial rerolls preserve explicit kept attributes', () => {
  for (const seed of [0, 72, 0x80000000, 0xffffffff]) {
    const character = generateCharacter(randomUUID(), { seed });
    assert.deepEqual(character.avatar, appearanceFromSeed(seed)); assert.equal(validateAppearance(character.avatar), character.avatar);
  }
  const avatar = appearanceFromSeed(42), rerolled = rerollAppearance(avatar, ['hair', 'skin'], 123);
  assert.equal(rerolled.attributes.hair, avatar.attributes.hair); assert.equal(rerolled.attributes.skin, avatar.attributes.skin);
  assert.notEqual(rerolled.attributes.beard, avatar.attributes.beard);
  const onlyBeard = rerollAppearance(avatar, [], 50, 'beard');
  for (const key of Object.keys(avatar.attributes)) assert.equal(onlyBeard.attributes[key] === avatar.attributes[key], key !== 'beard');
  assert.throws(() => rerollAppearance(avatar, ['__proto__']), /Invalid/);
  assert.throws(() => validateAppearance({ ...avatar, attributes: { ...avatar.attributes, hair: 'unsupported' } }));
  assert.throws(() => validateAppearance({ ...avatar, priorContext: 'A different session' }), /Unexpected/);
});
test('human identity is explicit or deterministically derived for old records and survives kept rerolls',()=>{
 const a=appearanceFromSeed(42),legacy={seed:42,attributes:{...a.attributes}};assert.equal(modelForAppearance(legacy),modelForAppearance(a));
 const edited={...a,realistic:{modelId:'Business_Female_02'}};assert.equal(modelForAppearance(rerollAppearance(edited,['model'],55)),edited.realistic.modelId);
 assert.equal(modelForAppearance(rerollAppearance(edited,[],55,'colour')),edited.realistic.modelId);assert.notEqual(modelForAppearance(rerollAppearance(edited,[],55,'model')),edited.realistic.modelId);
 assert.throws(()=>validateAppearance({...a,realistic:{modelId:'../../private'}}),/bundled/);
});

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'goc-characters-test-'));
  let service = createSessionService({ root });
  const server = http.createServer((req, res) => service.handle(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, profile = randomUUID();
  const call = async (url, method = 'GET', body, headers = {}) => {
    const response = await fetch(origin + url, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  const libUrl = p => `/api/characters?profileId=${p || profile}`;
  const sessionUrl = id => `/api/sessions${id ? '/' + id : ''}?profileId=${profile}`;
  const fields = character => characterFields(Object.fromEntries(['name', 'avatar', 'personality', 'code', 'voicePreference'].map(key => [key, character[key]])));
  const add = async (seed = 42) => {
    const library = (await call(libUrl())).data.library, character = generateCharacter(profile, { seed });
    const body = { requestId: randomUUID(), expectedRevision: library.revision, action: 'create', id: character.id, character: fields(character) };
    const response = await call(libUrl(), 'POST', body); assert.equal(response.status, 200, response.data.error);
    return { character: response.data.library.characters.find(item => item.id === character.id), library: response.data.library, body };
  };
  const createDraft = async () => {
    const response = await call(sessionUrl(), 'POST', { id: randomUUID(), requestId: randomUUID(), draft: { title: 'New situation', mode: 'discussion', situation: '' } }); assert.equal(response.status, 201); return response.data.session;
  };
  try { await run({ root, profile, origin, call, libUrl, sessionUrl, fields, add, createDraft, restart: () => { service = createSessionService({ root }); } }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'goc-characters-test-')); await rm(root, { recursive: true, force: true }); }
}

test('Virus bootstrap is stable per profile/version and never auto-completes orientation', async () => fixture(async ({ call, libUrl, restart, createDraft }) => {
  const results = await Promise.all(Array.from({ length: 4 }, () => call(libUrl())));
  const library = results[0].data.library;
  assert.ok(results.every(item => item.data.library.guideId === library.guideId));
  assert.equal(library.characters[0].name, 'Virus'); assert.equal(library.characters[0].avatar.attributes.hair, 'bald');
  assert.ok(Object.values(library.guideProgress.lessons).every(status => status === 'pending'));
  assert.equal(library.guideProgress.activeLesson, null);
  restart(); assert.deepEqual((await call(libUrl())).data.library, library);
  const session = await createDraft(); assert.equal(session.guidance.guide.id, library.guideId); assert.deepEqual(session.guidance.notes, []); assert.equal(session.guidance.activeLesson, null);
  const other = (await call(libUrl(randomUUID()))).data.library;
  assert.notEqual(other.guideId, library.guideId); assert.notEqual(other.profileId, library.profileId);
}));

test('saved edits, voice preferences, retries, and library revisions survive restart', async () => fixture(async ({ call, libUrl, add, fields, restart }) => {
  const { character, library, body } = await add(0xffffffff);
  const retried = await call(libUrl(), 'POST', body); assert.equal(retried.data.replayed, true); assert.equal(retried.data.library.characters.length, 2);
  const edit = { requestId: randomUUID(), expectedRevision: library.revision, action: 'update', id: character.id, character: { ...fields(character), name: 'Noor', personality: 'Thoughtful', code: 'Ask for evidence.', voicePreference: { style: 'crisp', pace: 'brisk' } } };
  assert.equal((await call(libUrl(), 'POST', edit)).status, 200);
  restart(); const loaded = (await call(libUrl())).data.library.characters.find(item => item.id === character.id);
  assert.equal(loaded.name, 'Noor'); assert.deepEqual(loaded.avatar, character.avatar); assert.deepEqual(loaded.voicePreference, { style: 'crisp', pace: 'brisk' }); assert.equal(loaded.voice, null); assert.equal(loaded.brain, null);
  assert.equal((await call(libUrl(), 'POST', edit)).data.replayed, true);
  assert.equal((await call(libUrl(), 'POST', { ...edit, requestId: randomUUID() })).status, 409);
  assert.equal((await call(libUrl(), 'POST', { ...edit, character: { ...edit.character, code: 'Changed retry' } })).status, 409);
}));

test('character operations enforce profile ownership, origin, supported attributes, and context-free identities', async () => fixture(async ({ call, libUrl, add, fields }) => {
  const { character, library } = await add();
  const body = { requestId: randomUUID(), expectedRevision: library.revision, action: 'update', id: character.id, character: fields(character) };
  assert.equal((await call(libUrl(randomUUID()), 'POST', { ...body, expectedRevision: 1 })).status, 404);
  assert.equal((await call(libUrl(), 'POST', body, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await call(libUrl(), 'POST', { ...body, character: { ...body.character, history: ['Private old context'] } })).status, 400);
  assert.equal((await call(libUrl(), 'POST', { ...body, character: { ...body.character, brain: { provider: 'invented', model: 'not-verified' } } })).status, 400);
  assert.equal((await call(libUrl(), 'POST', { ...body, character: { ...body.character, avatar: { ...body.character.avatar, attributes: { ...body.character.avatar.attributes, clothes: 'unsupported' } } } })).status, 400);
}));

test('session roles/removal and later library edits preserve snapshots and clean reuse', async () => fixture(async ({ call, libUrl, sessionUrl, add, fields, createDraft }) => {
  const { character, library } = await add(); const initial = await createDraft();
  const assign = { requestId: randomUUID(), expectedRevision: initial.revision, action: 'roster', entries: [{ characterId: character.id, role: 'Critic', code: 'Session-specific priority.' }] };
  let session = (await call(sessionUrl(initial.id), 'PATCH', assign)).data.session;
  assert.equal(session.participants[0].role, 'Critic'); assert.equal(session.characters[0].code, character.code);
  assert.equal((await call(sessionUrl(initial.id), 'PATCH', assign)).data.replayed, true);
  const edit = { requestId: randomUUID(), expectedRevision: library.revision, action: 'update', id: character.id, character: { ...fields(character), name: 'Updated library identity', code: 'New default.' } };
  assert.equal((await call(libUrl(), 'POST', edit)).status, 200);
  session = (await call(sessionUrl(initial.id))).data.session;
  assert.equal(session.characters[0].name, character.name); assert.equal(session.participants[0].code, 'Session-specific priority.');
  const removed = await call(sessionUrl(initial.id), 'PATCH', { requestId: randomUUID(), expectedRevision: session.revision, action: 'roster', entries: [] });
  assert.equal(removed.data.session.participants[0].active, false); assert.equal((await call(libUrl())).data.library.characters.length, 2);
  const next = await createDraft();
  const reused = (await call(sessionUrl(next.id), 'PATCH', { requestId: randomUUID(), expectedRevision: next.revision, action: 'roster', entries: [{ characterId: character.id, role: 'Examiner' }] })).data.session;
  assert.equal(reused.characters[0].name, 'Updated library identity'); assert.equal(reused.participants[0].position, ''); assert.equal(reused.participants[0].code, 'New default.'); assert.deepEqual(reused.contributions, []); assert.deepEqual(reused.guidance.notes, []);
  assert.equal((await call(libUrl())).data.library.characters.find(item => item.id === character.id).code, 'New default.');
}));

test('active-cast limits, duplicates, foreign characters, and guide separation are enforced', async () => fixture(async ({ call, sessionUrl, add, createDraft }) => {
  const cast = []; for (let i = 0; i < 6; i++) cast.push((await add(i)).character);
  const session = await createDraft(), request = entries => ({ requestId: randomUUID(), expectedRevision: session.revision, action: 'roster', entries });
  assert.equal((await call(sessionUrl(session.id), 'PATCH', request(cast.map(character => ({ characterId: character.id, role: 'Perspective' }))))).status, 400);
  assert.equal((await call(sessionUrl(session.id), 'PATCH', request([{ characterId: cast[0].id, role: 'One' }, { characterId: cast[0].id, role: 'Two' }]))).status, 400);
  assert.equal((await call(sessionUrl(session.id), 'PATCH', request([{ characterId: randomUUID(), role: 'Unknown' }]))).status, 400);
  assert.equal((await call(sessionUrl(session.id), 'PATCH', request([{ characterId: session.guidance.guide.id, role: 'Duplicate guide' }]))).status, 400);
  assert.equal((await call(sessionUrl(session.id), 'PATCH', request(cast.slice(0, 5).map(character => ({ characterId: character.id, role: 'Perspective' }))))).status, 200);
}));

test('older drafts remain unchanged on read and acquire their guide only on a roster mutation', async () => fixture(async ({ root, profile, call, sessionUrl, add, createDraft }) => {
  const { character } = await add(); const initial = await createDraft();
  delete initial.guidance;
  const file = path.join(root, '.sovereign', 'sessions', 'v1', profile, initial.id + '.json');
  const original = JSON.stringify(initial); await writeFile(file, original);
  const loaded = await call(sessionUrl(initial.id)); assert.equal(loaded.status, 200);
  assert.equal(loaded.data.session.guidance, undefined); assert.equal(await readFile(file, 'utf8'), original);
  const changed = await call(sessionUrl(initial.id), 'PATCH', { requestId: randomUUID(), expectedRevision: initial.revision, action: 'roster', entries: [{ characterId: character.id, role: 'Advisor' }] });
  assert.equal(changed.status, 200); assert.equal(changed.data.session.guidance.guide.name, 'Virus');
  assert.deepEqual(changed.data.session.guidance.notes, []);
}));

test('changing the default guide preserves old guide snapshots and pending lessons', async () => fixture(async ({ call, libUrl, add, createDraft, restart }) => {
  const { character, library } = await add(); const initial = await createDraft();
  assert.equal((await call(libUrl(), 'POST', { requestId: randomUUID(), expectedRevision: library.revision, action: 'guide', id: character.id })).status, 200);
  restart(); const next = await createDraft();
  assert.equal(next.guidance.guide.id, character.id); assert.notEqual(initial.guidance.guide.id, character.id);
  assert.ok(Object.values((await call(libUrl())).data.library.guideProgress.lessons).every(status => status === 'pending'));
}));

test('corrupt/future libraries and storage junctions do not reset or redirect saved data', async () => fixture(async ({ root, profile, call, libUrl }) => {
  await call(libUrl()); const file = path.join(root, '.sovereign', 'characters', 'v1', profile, 'library.json');
  const original = await readFile(file, 'utf8');
  for (const content of ['{invalid', JSON.stringify({ ...JSON.parse(original), schemaVersion: 99 })]) {
    await writeFile(file, content); assert.equal((await call(libUrl())).status, 409); assert.equal(await readFile(file, 'utf8'), content);
  }
  const other = randomUUID(), old = path.join(root, '.sovereign', 'old-records'); await mkdir(old);
  await symlink(old, path.join(root, '.sovereign', 'characters', 'v1', other), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await call(libUrl(other))).status, 409);
}));
