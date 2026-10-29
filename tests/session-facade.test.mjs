import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,readdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSessionService} from '../server/sessions.mjs';
import {startSessionServer} from '../server/session-server.mjs';
import {seedDiscussion} from './fixtures/discussion.mjs';

async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'goc-session-reader-')),seed=await seedDiscussion(root),profile=seed.profile,session=seed.session;
  let calls=0;const ai={catalog:async()=>({providers:[]})};
  for(const method of ['talk','setup','brief','discussion','speak','avatar','transcribe'])ai[method]=async()=>{calls++;throw Error('Retired route reached AI');};
  let service=createSessionService({root,ai});
  const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const route=(id=session.id,p=profile)=>`/api/sessions${id?'/'+id:''}?profileId=${p}`;
  const projection=(id=session.id,p=profile)=>`/api/studio/legacy-sessions/${id}?profileId=${p}`;
  const file=path.join(root,'.sovereign','sessions','v1',profile,session.id+'.json');
  const call=async(url,method='GET',headers={})=>{const response=await fetch(origin+url,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(['POST','PATCH'].includes(method)?{body:'{}'}:{})});return {status:response.status,data:await response.json()};};
  try{await run({root,profile,session,file,route,projection,call,calls:()=>calls,restart:()=>{service=createSessionService({root,ai});}});}
  finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-session-reader-'));await rm(root,{recursive:true,force:true});}
}

test('legacy reads and Studio projection survive restart without changing saved bytes or character IDs',()=>fixture(async({file,session,route,projection,call,restart,calls})=>{
  const before=await readFile(file,'utf8');
  for(let i=0;i<2;i++){
    assert.deepEqual((await call(route())).data.session,session);
    const result=await call(projection());assert.equal(result.status,200);assert.equal(result.data.readOnly,true);assert.deepEqual(result.data.session,session);assert.deepEqual(result.data.characterIds,session.characters.map(actor=>actor.id));
    assert.equal((await call(route(''))).data.sessions[0].id,session.id);restart();
  }
  assert.equal(calls(),0);assert.equal(await readFile(file,'utf8'),before);
}));

test('retired session writes and discussion, guide, context, character and inference APIs are absent',()=>fixture(async({root,file,route,projection,call,calls})=>{
  const before=await readFile(file,'utf8');
  for(const [url,method] of [[route(''),'POST'],[route(),'PATCH'],[route(),'DELETE'],[projection(),'POST'],['/api/characters','GET'],['/api/characters','POST'],['/api/news/india','GET'],['/api/context/extract','POST'],['/api/guidance/progress','POST'],...['control','turn','brief','cast','performance'].map(part=>[`/api/discussion/${randomUUID()}/${part}`,'POST']),...['talk','setup','narrate','avatar','transcribe','preview','assign','speech'].map(part=>['/api/ai/'+part,'POST'])])assert.equal((await call(url,method)).status,404,method+' '+url);
  assert.equal(calls(),0);assert.equal(await readFile(file,'utf8'),before);assert.deepEqual((await readdir(path.join(root,'.sovereign'))).sort(),['characters','sessions']);
}));

test('legacy reads enforce ownership, identifiers and cross-site restrictions',()=>fixture(async({session,route,projection,call})=>{
  const other=randomUUID();for(const url of [route(session.id,other),projection(session.id,other),route(randomUUID())])assert.equal((await call(url)).status,404);
  assert.deepEqual((await call(route('',other))).data,{sessions:[],unavailableCount:0});assert.equal((await call('/api/sessions?profileId=../../court')).status,400);
  for(const url of [route(),projection()])assert.equal((await call(url,'GET',{'Sec-Fetch-Site':'cross-site'})).status,403);
}));

test('invalid, future, inconsistent and misplaced records remain unchanged and are counted as unavailable',()=>fixture(async({file,session,route,projection,call})=>{
  for(const content of ['{broken',JSON.stringify({...session,schemaVersion:99}),JSON.stringify({...session,revision:999}),JSON.stringify({...session,id:randomUUID()}),JSON.stringify({...session,profileId:randomUUID()})]){
    await writeFile(file,content);for(const url of [route(),projection()])assert.equal((await call(url)).status,409);
    assert.deepEqual((await call(route(''))).data,{sessions:[],unavailableCount:1});assert.equal(await readFile(file,'utf8'),content);
  }
}));

test('missing storage is not created, and junctions and oversized records cannot redirect legacy reads',()=>fixture(async({root,file,route,projection,call})=>{
  const other=randomUUID(),base=path.join(root,'.sovereign','sessions','v1'),target=path.join(root,'old-records');await mkdir(target);
  assert.equal((await call(projection(randomUUID(),other))).status,404);assert.ok(!(await readdir(base)).includes(other));
  await symlink(target,path.join(base,other),process.platform==='win32'?'junction':'dir');assert.equal((await call(route('',other))).status,409);assert.equal((await call(projection(randomUUID(),other))).status,409);assert.deepEqual(await readdir(target),[]);
  await writeFile(file,' '.repeat(8_000_001));assert.equal((await call(route())).status,409);assert.equal((await readFile(file)).length,8_000_001);
}));

test('health, capabilities, catalogue and startSessionServer keep the public entry point usable',async()=>{
  await fixture(async({call})=>{
    const health=(await call('/api/health')).data;assert.equal(health.service,'studio');assert.equal(health.studio,true);
    const capabilities=(await call('/api/session-capabilities')).data;assert.equal(capabilities.studio,true);assert.equal(capabilities.legacySessions,'read-only');assert.ok(!capabilities.discussion&&!capabilities.guidedSetup&&!capabilities.contextReview);
    assert.deepEqual((await call('/api/ai/catalog')).data,{providers:[]});assert.equal((await call('/api/ai/catalog','POST')).status,404);assert.equal((await call('/api/studio/catalog')).status,200);
  });
  const root=await mkdtemp(path.join(tmpdir(),'goc-session-start-'));let server;
  try{server=await startSessionServer({root,port:0});assert.equal((await(await fetch(`http://127.0.0.1:${server.port}/api/health`)).json()).studio,true);assert.deepEqual(await readdir(root),[]);}
  finally{await server?.close();await rm(root,{recursive:true,force:true});}
});
