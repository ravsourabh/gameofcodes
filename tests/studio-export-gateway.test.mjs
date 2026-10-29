import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createExportGateway} from '../scripts/qa/studio-export-gateway.mjs';
import {createStudioOutput} from '../server/studio-output.mjs';
import {createStudioService} from '../server/studio-service.mjs';

const listen=async server=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;};
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});

test('the real HTTP gateway preserves range previews, same-origin download checks and automatic cloud cleanup',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'goc-gateway-')),dist=path.join(root,'dist'),profile=randomUUID(),output=createStudioOutput({root});
 await mkdir(dist);await writeFile(path.join(dist,'index.html'),'<main>Frozen production fixture</main>');
 const take={id:randomUUID(),castSnapshots:[],productionSnapshot:{runId:'run',turns:[{id:'line',runId:'run',beatId:'beat',characterId:randomUUID(),text:'Fixture only',voiceAssetId:'a'.repeat(64),startMs:0,durationMs:1000,characterSnapshot:{name:'QA'}}]}};
 const job=await output.create(profile,{id:randomUUID(),format:'horizontal',subtitleMode:'separate'},take,randomUUID()),dir=path.join(root,'.sovereign/studio/v1',profile,'exports'),stem=path.join(dir,job.id);
 const raw=JSON.parse(await readFile(stem+'.json','utf8'));raw.status='completed';raw.bytes=4096;await writeFile(stem+'.json',JSON.stringify(raw));await writeFile(stem+'.mp4',Buffer.alloc(4096,73));
 const service=createStudioService({root,ai:{}}),backend=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost'))),gateway=createExportGateway({dist});
 const backendOrigin=await listen(backend),origin=await listen(gateway);
 try{
   assert.equal((await fetch(origin+'/')).status,200);assert.equal((await fetch(origin+'/api/studio/exports?profileId='+profile)).status,503);
   assert.equal((await fetch(origin+'/__qa/backend',{method:'POST',body:JSON.stringify({origin:'https://external.invalid'})})).status,400);
   assert.equal((await fetch(origin+'/__qa/backend',{method:'POST',body:JSON.stringify({origin:backendOrigin})})).status,200);
   const base=origin+'/api/studio/exports/'+job.id,query='?profileId='+profile;
   const preview=await fetch(base+'/video'+query,{headers:{Range:'bytes=0-255'}});assert.equal(preview.status,206);assert.equal((await preview.arrayBuffer()).byteLength,256);assert.equal((await output.get(profile,job.id)).status,'completed');
   assert.equal((await fetch(base+'/download'+query,{headers:{Referer:'https://unrelated.invalid/'}})).status,403);
   const subtitles=await fetch(base+'/subtitles'+query);assert.match(subtitles.headers.get('content-type'),/charset=utf-8/);assert.match(await subtitles.text(),/-->/);
   const download=await fetch(base+'/download'+query,{headers:{Referer:origin+'/'}});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.equal(download.headers.get('accept-ranges'),'none');assert.equal((await download.arrayBuffer()).byteLength,4096);
   for(let n=0;n<100&&(await readdir(dir)).length;n++)await new Promise(resolve=>setTimeout(resolve,10));
   assert.deepEqual(await readdir(dir),[]);assert.equal((await fetch(base+query)).status,404);
 }finally{await close(gateway);await close(backend);assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-gateway-'));await rm(root,{recursive:true,force:true});}
});
