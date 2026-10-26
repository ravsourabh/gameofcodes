// Manual, bounded live check: one setup inference, no speech or transcription.
// Loads ignored local configuration without printing any credential values.
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSessionService} from '../server/sessions.mjs';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const root=await mkdtemp(path.join(tmpdir(),'goc-live-setup-'));
const service=createSessionService({root}),server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,profile=randomUUID();
async function call(route,input,method=input?'POST':'GET'){
  const response=await fetch(origin+route,{method,headers:{origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});const result=await response.json();assert.ok(response.ok,result.error||'Request failed');return result;
}
try{
  const catalog=await call('/api/ai/catalog'),provider=catalog.providers.find(p=>p.id==='openai'&&p.models.some(m=>m.id==='gpt-5.4-nano'));
  assert.ok(provider,'The expected live setup model is not available.');
  const route='/api/sessions?profileId='+profile;
  let {session}=await call(route,{id:randomUUID(),requestId:randomUUID(),draft:{title:'Live setup verification',mode:'rehearsal',situation:''}});
  ({session}=await call('/api/ai/assign?profileId='+profile,{sessionId:session.id,requestId:randomUUID(),expectedRevision:session.revision,characterId:session.guidance.guide.id,brain:{provider:provider.id,model:'gpt-5.4-nano'},voice:{provider:'browser',id:'default'}}));
  ({session}=await call(`/api/sessions/${session.id}?profileId=${profile}`,{requestId:randomUUID(),expectedRevision:session.revision,action:'guidance',operation:'capture',payload:{text:'I am defending my research proposal. Help me practise explaining the method to a sceptical panel. I have ten minutes.'}},'PATCH'));
  ({session}=await call('/api/ai/setup?profileId='+profile,{sessionId:session.id,requestId:randomUUID(),expectedRevision:session.revision}));
  assert.equal(session.guidance.setup.stage,'review');assert.equal(session.status,'draft');assert.equal(session.guidance.notes.at(-1).status,'unconfirmed');
  console.log(JSON.stringify({liveSetup:true,actualBrain:session.guidance.setup.brain,mode:session.guidance.setup.proposal.mode,suggestedRoles:session.guidance.setup.proposal.cast.length,readbackSaved:true,started:false}));
}finally{
  await new Promise(r=>{server.close(r);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.join(tmpdir(),'goc-live-setup-')));await rm(root,{recursive:true,force:true});
}
