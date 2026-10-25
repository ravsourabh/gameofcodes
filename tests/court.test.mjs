import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCourtService } from '../server/court.mjs';

for (const failure of [false, true]) test(`async build ${failure ? 'reports failure safely' : 'polls pending then complete'} without duplicate generation`, { timeout: 10_000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sovereign-court-test-'));
  const project = randomUUID(), proposalId = randomUUID(), requestId = randomUUID();
  const folder = path.join(root, '.sovereign', 'court');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${project}.json`), JSON.stringify({ history: [], proposal: { id: proposalId, title: 'Tracker', requirements: ['Track books'], status: 'awaiting-approval' }, artifact: null, checks: [], version: 0 }));
  let release, started, calls = 0, loaded = '';
  const blocked = new Promise(resolve => { release = resolve; });
  const generating = new Promise(resolve => { started = resolve; });
  const bridge = { async status() { return { providers: [] }; }, async generate() {
    calls++; started(); await blocked;
    if (failure) throw Object.assign(new Error('SECRET-token <html>upstream timeout</html> D:/private/path'), { status: 502 });
    return { html: '<h1>Tracker</h1>', css: 'body{color:teal}', js: '', summary: 'Ready' };
  } };
  const room = { queue: Promise.resolve(), page: { on() {}, off() {}, url() { return loaded; }, async goto(url) { loaded = url; }, locator() { return { async innerText() { return 'Tracker'; } }; } } };
  const createService = () => createCourtService({ root, bridge, getRoom: async () => room, saveRoom: async () => {}, broadcast() {} });
  let court = createService();
  const server = http.createServer((req, res) => court.handle(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const post = async data => {
    const response = await fetch(`${address}/api/court/build`, { method: 'POST', headers: { Origin: address, 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(2000) });
    return { status: response.status, data: await response.json() };
  };
  const poll = async (id = requestId, projectId = project) => {
    const response = await fetch(`${address}/api/court/build-status?project=${projectId}&requestId=${id}`);
    return { status: response.status, data: await response.json() };
  };
  const input = { project, proposalId, requestId, async: true };
  try {
    assert.deepEqual(await post(input), { status: 202, data: { pending: true, requestId } });
    const initial = await poll();
    assert.equal(initial.status, 200);assert.equal(initial.data.status, 'pending');
    assert.ok(['queued','generating'].includes(initial.data.stage));assert.ok(initial.data.startedAt > 0);
    await generating;
    assert.equal((await poll()).data.stage, 'generating');
    const pending = JSON.parse(await readFile(path.join(folder, `${project}.json`), 'utf8'));
    assert.equal(pending.activeBuildRequestId, requestId);
    const activeStatus = await fetch(`${address}/api/court/status?project=${project}`).then(response => response.json());
    assert.equal(activeStatus.activeBuildRequestId, requestId);
    assert.equal((await post(input)).status, 202);
    const competingRequest = randomUUID();
    assert.equal((await post({ ...input, requestId: competingRequest })).status, 202);
    assert.equal((await poll(competingRequest)).data.status, 'error');
    // A different request must fail the project lock without starting another build.
    assert.equal((await poll('bad')).status, 400);
    assert.equal((await post({ ...input, requestId: 'bad' })).status, 400);
    assert.equal((await poll(requestId, '../outside')).status, 400);
    assert.equal((await poll(randomUUID())).data.status, 'error');
    assert.equal((await poll(requestId, randomUUID())).data.status, 'error');
    release();
    let result;
    for (let i = 0; i < 100; i++) {
      result = await poll();
      if (result.data.status !== 'pending') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(result.status, 200);
    assert.equal(calls, 1);
    const saved = JSON.parse(await readFile(path.join(folder, `${project}.json`), 'utf8'));
    assert.equal(saved.activeBuildRequestId, null);
    assert.equal(saved.lastBuild.requestId, requestId);
    assert.equal(saved.lastBuild.status, result.data.status);
    if (failure) {
      assert.equal(result.data.status, 'error');
      assert.doesNotMatch(result.data.error, /SECRET|html|private/);
      assert.equal(Object.hasOwn(result.data, 'result'), false);
      assert.equal(saved.proposal.status, 'awaiting-approval');
      assert.equal(saved.artifact, null);
    } else {
      assert.equal(result.data.status, 'complete');
      assert.equal(result.data.result.role, 'builder');
      assert.equal(result.data.result.artifact.title, 'Tracker');
      assert.equal(saved.proposal.status, 'ready-for-review');
      assert.deepEqual((await post({ ...input, async: false })).data, result.data.result);
    }
    assert.equal((await post(input)).status, 202);
    assert.deepEqual(await poll(), result);
    assert.equal(calls, 1);
    court = createService();
    assert.deepEqual(await poll(), result, 'Final outcome survives a service restart');
    if (!failure) assert.deepEqual((await post({ ...input, async: false })).data, result.data.result);
    assert.equal(calls, 1);
    const lostProject = randomUUID(), lostRequest = randomUUID();
    await writeFile(path.join(folder, `${lostProject}.json`), JSON.stringify({ history: [], proposal: { id: randomUUID(), status: 'building' }, activeBuildRequestId: lostRequest, lastBuild: { requestId: lostRequest, status: 'pending' } }));
    const lost = await poll(lostRequest, lostProject);
    assert.equal(lost.status, 200); assert.equal(lost.data.status, 'error'); assert.match(lost.data.error, /restarted.*lost/);
    const recovered = JSON.parse(await readFile(path.join(folder, `${lostProject}.json`), 'utf8'));
    assert.equal(recovered.activeBuildRequestId, null);
    assert.equal(recovered.proposal.status, 'awaiting-approval');
  } finally {
    release();
    await post({ ...input, async: false });
    await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'sovereign-court-test-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('Virus plans with its assigned brain, validates before saving, and onboarding belongs to each project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sovereign-court-test-'));
  const project = randomUUID(), other = randomUUID();
  let calls = 0, reply = { speech: 'Start with a book list, then add progress tracking.', title: 'Reading tracker', milestones: ['Create book list', 'Track reading progress'], requirements: ['Add books', 'Save progress'] };
  const bridge = {
    async status() { return { providers: [{ id: 'claude', installed: true, state: 'not-checked' }, { id: 'muse', installed: false, state: 'disabled' }, { id: 'codex', installed: true, state: 'error' }, { id: 'gemini', installed: false, state: 'not-installed' }] }; },
    async generate(input, options) { calls++; assert.equal(options.providerId, 'claude'); assert.deepEqual(options.schema.required, ['speech', 'title', 'milestones', 'requirements']); assert.match(input[0].content, /no poetry or riddles/); return reply; },
  };
  let court = createCourtService({ root, bridge });
  const server = http.createServer((req, res) => court.handle(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const post = async (endpoint, data) => { const response = await fetch(`${address}/api/court/${endpoint}`, { method: 'POST', headers: { Origin: address, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: response.status, data: await response.json() }; };
  const status = async id => fetch(`${address}/api/court/status${id ? `?project=${id}` : ''}`).then(res => res.json());
  try {
    for (const provider of ['muse', 'codex', 'gemini']) assert.equal((await post('brain', { project, role: 'virus', provider })).status, 503);
    assert.equal((await post('brain', { project, role: 'virus', provider: 'claude' })).status, 200);
    assert.equal(calls, 0);
    const input = { project, idea: 'Build a reading tracker', requestId: randomUUID() };
    const planned = await post('plan-idea', input);
    assert.equal(planned.status, 200); assert.equal(planned.data.role, 'virus');
    assert.equal(planned.data.proposal.status, 'awaiting-approval');
    assert.deepEqual(planned.data.proposal.requirements, reply.requirements);
    assert.deepEqual(planned.data.charter.milestones.map(item => item.title), reply.milestones);
    assert.deepEqual((await post('plan-idea', input)).data, planned.data); assert.equal(calls, 1);
    const file = path.join(root, '.sovereign', 'court', `${project}.json`);
    const before = await readFile(file, 'utf8');
    assert.equal(JSON.parse(before).history.length, 2);
    for (const malformed of [null, { ...reply, speech: '' }, { ...reply, title: 1 }, { ...reply, milestones: [''] }, { ...reply, requirements: ['ok', 12] }, { ...reply, requirements: [] }, { ...reply, extra: true }]) {
      reply = malformed;
      assert.equal((await post('plan-idea', { ...input, requestId: randomUUID() })).status, 502);
      assert.equal(await readFile(file, 'utf8'), before);
      assert.deepEqual((await status(project)).charter, planned.data.charter);
    }
    assert.equal((await post('complete-onboarding', {})).status, 400);
    assert.equal((await post('complete-onboarding', { project })).status, 200);
    court = createCourtService({ root, bridge });
    assert.equal((await status(project)).onboarded, true);
    assert.equal((await status(other)).onboarded, false);
    assert.equal((await status(project)).mode, 'local');
    assert.equal(Object.hasOwn(await status(), 'onboarded'), false);
    await assert.rejects(readFile(path.join(root, '.sovereign', 'connection.json')), { code: 'ENOENT' });
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'sovereign-court-test-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('court uses the local assistant bridge, plan versions, idempotency and source boundaries', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'sovereign-court-test-'));
  const originalFetch=globalThis.fetch;let upstreamCalls=0,loadedUrl='',connected=false;const routedProviders=[];
  const responses=[
    {speech:'Let’s make a reading tracker.',proposal:{title:'Reading tracker',requirements:['Add books','Track progress','Save the list']}},
    {speech:'Here is the revised plan.',proposal:{title:'Revised reading tracker',requirements:['Add books','Mark favorites','Save the list']}},
    {html:'<h1>My books</h1><button id="add">Add book</button>',css:'body{background:#faf5e9}',js:'document.querySelector("#add").addEventListener("click",()=>{});',summary:'Ready to review.'},
  ];
  const bridge={async status(){return{configured:connected,selectedProvider:'codex',provider:'ChatGPT · Codex',providers:['codex','claude','muse'].map(id=>({id,installed:true,state:'not-checked'}))};},async select(id){assert.equal(id,'codex');connected=true;},async check(){},async generate(input,options){if(!connected)throw Object.assign(new Error('Connect a local assistant.'),{status:503});routedProviders.push(options.providerId);assert.ok(input[0].content);assert.equal(options.schema.type,'object');const data=responses[upstreamCalls++];assert.ok(data,'Unexpected assistant call');return data;}};
  const room={queue:Promise.resolve(),page:{on(){},off(){},url(){return loadedUrl||'http://127.0.0.1:4174/';},async goto(url){loadedUrl=url;},locator(){return{async innerText(){return'My books Add book';}};}}};
  const court=createCourtService({root,getRoom:async()=>room,saveRoom:async()=>{},broadcast:()=>{},bridge});
  const server=http.createServer(async(req,res)=>{if(!await court.handle(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=`http://127.0.0.1:${server.address().port}`;
  const call=async(endpoint,data,origin=address)=>{
    const result=await originalFetch(`${address}/api/court/${endpoint}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
    return{status:result.status,data:await result.json()};
  };
  try{
    const project=randomUUID();
    const missing=await call('converse',{project,role:'architect',message:'Build a reading tracker',requestId:randomUUID()});
    assert.equal(missing.status,503);assert.match(missing.data.error,/Connect a local assistant/);assert.equal(upstreamCalls,0);
    assert.equal((await call('provider',{provider:'codex'})).status,200);
    assert.equal((await call('brain',{project,role:'architect',provider:'claude'})).status,200);
    assert.equal((await call('brain',{project,role:'builder',provider:'muse'})).status,200);
    assert.equal((await call('brain',{project,role:'inspector',provider:'unknown'})).status,400);
    assert.equal(upstreamCalls,0,'Changing a brain must not consume a model turn.');
    const blocked=await call('converse',{project,role:'architect',message:'Hello',requestId:randomUUID()},'https://unrelated.example');assert.equal(blocked.status,403);
    const first=await call('converse',{project,role:'architect',message:'Build a reading tracker',requestId:randomUUID()});assert.equal(first.status,200);
    const second=await call('converse',{project,role:'architect',message:'Use favorites instead',requestId:randomUUID()});assert.equal(second.status,200);assert.notEqual(first.data.proposal.id,second.data.proposal.id);
    const stale=await call('build',{project,proposalId:first.data.proposal.id,requestId:randomUUID()});assert.equal(stale.status,409);assert.equal(upstreamCalls,2);
    const requestId=randomUUID(),build={project,proposalId:second.data.proposal.id,requestId};
    const built=await call('build',build);assert.equal(built.status,200);assert.equal(built.data.checks.at(-1).passed,null);assert.match(loadedUrl,new RegExp(`/projects/${project}/`));
    assert.match(built.data.speech,/startup checks passed/);assert.notEqual(built.data.speech,'Ready to review.');
    const duplicate=await call('build',build);assert.deepEqual(duplicate.data,built.data);assert.equal(upstreamCalls,3);
    const folder=path.join(root,'.sovereign','builds',project,built.data.artifact.version);
    assert.match(await readFile(path.join(folder,'index.html'),'utf8'),/<script src="app.js" defer>/);
    assert.match(await readFile(path.join(folder,'app.js'),'utf8'),/addEventListener/);
    const filesResponse=await originalFetch(`${address}/api/court/files?project=${project}`);
    assert.equal(filesResponse.status,200);
    const {files}=await filesResponse.json();
    assert.deepEqual(Object.keys(files),['index.html','app.css','app.js']);
    for(const [name,content] of Object.entries(files)) assert.equal(content,await readFile(path.join(folder,name),'utf8'));
    assert.equal((await originalFetch(`${address}/api/court/files?project=../outside`)).status,400);
    assert.equal((await originalFetch(`${address}/api/court/files?project=${randomUUID()}`)).status,404);
    const archiveResponse=await originalFetch(`${address}/api/court/source?project=${project}`);
    assert.equal(archiveResponse.status,200);assert.equal(archiveResponse.headers.get('content-type'),'application/zip');
    const archive=Buffer.from(await archiveResponse.arrayBuffer());assert.equal(archive.readUInt32LE(0),0x04034b50);
    let position=0;const exported={};
    while(archive.readUInt32LE(position)===0x04034b50){const size=archive.readUInt32LE(position+18),nameLength=archive.readUInt16LE(position+26),start=position+30+nameLength;exported[archive.toString('utf8',position+30,start)]=archive.toString('utf8',start,start+size);position=start+size;}
    assert.deepEqual(Object.keys(exported),['index.html','app.css','app.js','README.txt']);assert.match(exported['README.txt'],/Requirements and usability: needs review/);assert.match(exported['app.js'],/addEventListener/);
    const status=await originalFetch(`${address}/api/court/status?project=${project}`).then(response=>response.json());
    assert.equal(status.artifact.title,'Revised reading tracker');assert.equal(status.provider,'ChatGPT · Codex');
    assert.deepEqual(routedProviders,['claude','claude','muse']);
    assert.deepEqual(status.brains,{architect:'claude',builder:'muse'});
    const saved=JSON.parse(await readFile(path.join(root,'.sovereign','court',`${project}.json`),'utf8'));assert.deepEqual(saved.brains,status.brains);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'sovereign-court-test-'));
    await rm(root,{recursive:true,force:true});
  }
});
