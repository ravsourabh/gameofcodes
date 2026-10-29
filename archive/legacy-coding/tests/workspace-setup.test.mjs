import http from 'node:http';
import { createCourtService } from '../server/court.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSetup, exportLocalBuild } from '../server/workspace-setup.mjs';

test('setup enforces actual execution mode and local account verification',async()=>{
  const input={profileId:randomUUID(),profileName:'Sourabh',mode:'cloud',activity:'explore'};
  assert.equal((await validateSetup(input,'cloud',[])).workspace,null);
  await assert.rejects(validateSetup({...input,mode:'local'},'cloud',[]),/runs in cloud/);
  await assert.rejects(validateSetup({...input,mode:'local',workspace:process.cwd()},'local',[]),/Check at least one/);
  const connected=[{installed:true,state:'connected'}];
  await assert.rejects(validateSetup({...input,mode:'local',workspace:'relative'},'local',connected),/absolute/);
  const local=await validateSetup({...input,mode:'local',workspace:process.cwd()},'local',connected);
  assert.ok(path.isAbsolute(local.workspace));
  await assert.rejects(validateSetup({...input,profileName:''},'cloud',[]),/profile name/);
});

test('local builds export into new version directories and never follow an export junction',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'goc-workspace-'));
  try{
    const workspace=path.join(root,'workspace'),source=path.join(root,'source');
    await mkdir(workspace);await mkdir(source);
    for(const name of ['index.html','app.css','app.js'])await writeFile(path.join(source,name),name);
    const project=randomUUID(),version=randomUUID();
    const destination=await exportLocalBuild(workspace,project,version,source);
    assert.equal(await readFile(path.join(destination,'index.html'),'utf8'),'index.html');
    await assert.rejects(exportLocalBuild(workspace,project,version,source),/exist/i);
    const unsafe=path.join(root,'unsafe');await mkdir(unsafe);
    await symlink(source,path.join(unsafe,'.game-of-codes'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(exportLocalBuild(unsafe,project,version,source),/symbolic link/);
  }finally{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-workspace-'));await rm(root,{recursive:true,force:true});}
});


test('setup is persisted per project and rejects a mode switch at the service boundary',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'goc-setup-service-'));
  const project=randomUUID(),other=randomUUID();
  const mode=process.env.SOVEREIGN_MODE==='cloud'?'cloud':'local';
  const bridge={async status(){return {providers:[{id:'codex',installed:true,state:'connected'}]};}};
  const make=()=>createCourtService({root,bridge});let service=make();
  const server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  const input={project,profileId:randomUUID(),profileName:'Work',mode,activity:'explore',workspace:root};
  const post=async body=>{const r=await fetch(address+'/api/court/setup',{method:'POST',headers:{Origin:address,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  try{
    assert.equal((await post({...input,mode:mode==='cloud'?'local':'cloud'})).status,409);
    const saved=await post(input);assert.equal(saved.status,200);assert.equal(saved.data.setup.profileName,'Work');
    service=make();
    const restored=await fetch(address+'/api/court/status?project='+project).then(r=>r.json());
    assert.equal(restored.setup.profileId,input.profileId);assert.equal(restored.setup.activity,'explore');
    const fresh=await fetch(address+'/api/court/status?project='+other).then(r=>r.json());assert.equal(fresh.setup,null);
  }finally{await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-setup-service-'));await rm(root,{recursive:true,force:true});}
});
