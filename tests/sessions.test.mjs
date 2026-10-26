import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSessionService } from '../server/sessions.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'goc-session-test-'));
  let service = createSessionService({ root });
  const server = http.createServer((req, res) => service.handle(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profileId = randomUUID();
  const call = async (route, method = 'GET', input, headers = {}) => {
    const response = await fetch(`${origin}${route}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    return { status: response.status, data: await response.json() };
  };
  const route = (id = '', profile = profileId) => `/api/sessions${id ? '/' + id : ''}?profileId=${profile}`;
  const create = (overrides = {}) => ({ id: randomUUID(), requestId: randomUUID(), draft: { title: 'Court choice', mode: 'discussion', situation: 'Choose an experiment.' }, ...overrides });
  try { await run({ root, origin, profileId, call, route, create, restart: () => { service = createSessionService({ root }); } }); }
  finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'goc-session-test-'));
    await rm(root, { recursive: true, force: true });
  }
}

test('sessions persist independently of legacy data and survive a service restart', async () => fixture(async ({ root, call, route, create, restart }) => {
  const id = randomUUID(), oldFolder = path.join(root, '.sovereign', 'court');
  await mkdir(oldFolder, { recursive: true });
  const legacy = '{"proposal":{"title":"Preserved work"},"version":5}';
  await writeFile(path.join(oldFolder, `${id}.json`), legacy);
  const input = create({ id });
  assert.deepEqual((await call(route())).data.sessions, []);
  assert.equal((await call(route(id))).status, 404);
  const first = await call(route(), 'POST', input); assert.equal(first.status, 201); assert.equal(first.data.session.revision, 1);
  restart(); const restored = await call(route(id)); assert.deepEqual(restored.data.session, first.data.session);
  assert.equal((await call(route())).data.sessions.length, 1);
  assert.equal(await readFile(path.join(oldFolder, `${id}.json`), 'utf8'), legacy);
  assert.equal((await call('/api/court/build', 'POST', {})).status, 404);
  assert.equal((await call('/preview')).status, 404);
  assert.deepEqual((await call('/api/health')).data, { ok: true, service: 'sessions', schemaVersion: 1, previewEnabled: false, inferenceEnabled: true });
}));

test('profile boundaries, identifiers, methods, origins, and mutation fields are enforced', async () => fixture(async ({ call, route, create }) => {
  const input = create(), saved = await call(route(), 'POST', input);
  assert.equal(saved.status, 201);
  const other = randomUUID();
  assert.equal((await call(route(input.id, other))).status, 404);
  assert.equal((await call(route(input.id, other), 'PATCH', { requestId: randomUUID(), expectedRevision: 1, action: 'cancel' })).status, 404);
  assert.deepEqual((await call(route('', other))).data.sessions, []);
  assert.equal((await call('/api/sessions?profileId=../../court')).status, 400);
  assert.equal((await call(route(), 'POST', create(), { Origin: 'https://different.example' })).status, 403);
  assert.equal((await call(route(), 'POST', create(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await call(route(input.id), 'DELETE')).status, 405);
  assert.equal((await call(route(input.id), 'PATCH', { requestId: randomUUID(), expectedRevision: 1, action: 'start' })).status, 400);
  assert.equal((await call(route(), 'POST', { ...create(), profileId: other })).status, 400);
}));

test('duplicate retries, competing revisions, and cancellation commit exactly once', async () => fixture(async ({ call, route, create, restart }) => {
  const input = create();
  const duplicates = await Promise.all([call(route(), 'POST', input), call(route(), 'POST', input)]);
  assert.deepEqual(duplicates.map(item => item.status).sort(), [200, 201]);
  assert.equal(duplicates[0].data.session.events.length, 1);
  const change = { requestId: randomUUID(), expectedRevision: 1, action: 'update', draft: { title: 'A rehearsal', mode: 'rehearsal', situation: 'Defend the proposal.' } };
  const first = await call(route(input.id), 'PATCH', change); assert.equal(first.status, 200); assert.equal(first.data.session.epoch, 1);
  restart(); const replay = await call(route(input.id), 'PATCH', change);
  assert.equal(replay.data.replayed, true); assert.equal(replay.data.session.revision, 2);
  const attempts = await Promise.all([1, 2].map(n => call(route(input.id), 'PATCH', { ...change, requestId: randomUUID(), expectedRevision: 2, draft: { ...change.draft, title: `Competing ${n}` } })));
  assert.deepEqual(attempts.map(item => item.status).sort(), [200, 409]);
  const cancel = { requestId: randomUUID(), expectedRevision: 3, action: 'cancel' };
  const cancelled = await call(route(input.id), 'PATCH', cancel); assert.equal(cancelled.data.session.epoch, 3);
  assert.equal((await call(route(input.id), 'PATCH', cancel)).data.session.revision, 4);
  assert.equal((await call(route(input.id))).data.session.events.length, 4);
}));

test('concurrent first saves create one dedicated profile folder without losing sessions', async () => fixture(async ({ call, route, create }) => {
  const results = await Promise.all(Array.from({ length: 4 }, () => call(route(), 'POST', create())));
  assert.ok(results.every(item => item.status === 201));
  assert.equal((await call(route())).data.sessions.length, 4);
}));

test('corrupt and future-version sessions are never silently reset or overwritten', async () => fixture(async ({ root, profileId, call, route, create }) => {
  const input = create(), saved = await call(route(), 'POST', input);
  const file = path.join(root, '.sovereign', 'sessions', 'v1', profileId, `${input.id}.json`);
  for (const content of ['{broken', JSON.stringify({ ...saved.data.session, schemaVersion: 99 })]) {
    await writeFile(file, content);
    assert.equal((await call(route(input.id))).status, 409);
    assert.equal((await call(route(), 'POST', input)).status, 409);
    assert.equal((await call(route(input.id), 'PATCH', { requestId: randomUUID(), expectedRevision: 1, action: 'cancel' })).status, 409);
    assert.equal((await call(route())).data.unavailableCount, 1);
    assert.equal(await readFile(file, 'utf8'), content);
  }
}));

test('storage junctions cannot redirect a new session into legacy data', async () => fixture(async ({ root, profileId, call, route, create }) => {
  const base = path.join(root, '.sovereign', 'sessions', 'v1'), oldFolder = path.join(root, '.sovereign', 'court');
  await mkdir(base, { recursive: true }); await mkdir(oldFolder);
  await symlink(oldFolder, path.join(base, profileId), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await call(route(), 'POST', create())).status, 409);
  assert.deepEqual(await readdir(oldFolder), []);
}));

test('chunked Unicode input is saved without corrupting multibyte characters', async () => fixture(async ({ origin, call, route, create }) => {
  const input = create({ draft: { title: '研究 ☀', mode: 'discussion', situation: 'नमस्ते — which choice?' } });
  const result = await new Promise((resolve, reject) => {
    const request = http.request(origin + route(), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' } }, response => {
      let raw = ''; response.on('data', chunk => { raw += chunk; }); response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(raw) }));
    }); request.on('error', reject);
    for (const byte of Buffer.from(JSON.stringify(input))) request.write(Buffer.from([byte]));
    request.end();
  });
  assert.equal(result.status, 201); assert.equal((await call(route(input.id))).data.session.scenario.situation, input.draft.situation);
}));
