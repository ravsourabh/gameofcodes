import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCourtService } from '../server/court.mjs';

test('court uses the local assistant bridge, plan versions, idempotency and source boundaries', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'sovereign-court-test-'));
  const originalFetch=globalThis.fetch;let upstreamCalls=0,loadedUrl='',connected=false;const routedProviders=[];
  const responses=[
    {speech:'Let’s make a reading tracker.',proposal:{title:'Reading tracker',requirements:['Add books','Track progress','Save the list']}},
    {speech:'Here is the revised plan.',proposal:{title:'Revised reading tracker',requirements:['Add books','Mark favorites','Save the list']}},
    {html:'<h1>My books</h1><button id="add">Add book</button>',css:'body{background:#faf5e9}',js:'document.querySelector("#add").addEventListener("click",()=>{});',summary:'Ready to review.'},
  ];
  const bridge={async status(){return{configured:connected,selectedProvider:'codex',provider:'ChatGPT · Codex',providers:[]};},async select(id){assert.equal(id,'codex');connected=true;},async check(){},async generate(input,options){if(!connected)throw Object.assign(new Error('Connect a local assistant.'),{status:503});routedProviders.push(options.providerId);assert.ok(input[0].content);assert.equal(options.schema.type,'object');const data=responses[upstreamCalls++];assert.ok(data,'Unexpected assistant call');return data;}};
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
