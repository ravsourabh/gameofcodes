// Bounded live service check: one setup proposal and four discussion turns, no audio.
import http from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createSessionService} from '../server/sessions.mjs';import {generateCharacter,characterFields} from '../shared/character-domain.mjs';
import {createSessionAI} from '../server/session-ai.mjs';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const transport=async(url,options)=>{const response=await fetch(url,options);if(!response.ok){let error;try{error=await response.clone().json();}catch{}const message=String(error?.error?.message||error?.message||'').replace(/sk[-_][a-zA-Z0-9_-]+/g,'[redacted]').slice(0,600);console.error(JSON.stringify({provider:new URL(url).hostname,status:response.status,code:error?.error?.code,type:error?.error?.type,message}));}return response;};
const root=await mkdtemp(path.join(tmpdir(),'goc-live-discussion-')),service=createSessionService({root,ai:createSessionAI({transport})}),server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,profile=randomUUID();let session;
async function call(route,input,method=input?'POST':'GET'){const res=await fetch(origin+route,{method,headers:{origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}),data=await res.json();assert.ok(res.ok,data.error||'Request failed');if(data.session)session=data.session;return data;}
const mutation=(fields={})=>({requestId:randomUUID(),expectedRevision:session.revision,...fields});
const route=()=>`/api/sessions/${session.id}?profileId=${profile}`;
try{
 const catalogue=await call('/api/ai/catalog'),openai=catalogue.providers.find(p=>p.id==='openai'&&p.models.some(m=>m.id==='gpt-5.4-nano')),anthropic=catalogue.providers.find(p=>p.id==='anthropic');assert.ok(openai&&anthropic,'Both configured providers are required.');
 const haiku=anthropic.models.find(m=>m.id==='claude-haiku-4-5-20251001')||anthropic.models.find(m=>m.id.includes('haiku'));assert.ok(haiku,'A connected Claude Haiku model is required.');
 const brains=[{provider:'openai',model:'gpt-5.4-nano'},{provider:'anthropic',model:haiku.id}],voice={provider:'browser',id:'default'};
 await call('/api/sessions?profileId='+profile,{id:randomUUID(),requestId:randomUUID(),draft:{title:'Live discussion check',mode:'discussion',situation:''}});
 await call('/api/ai/assign?profileId='+profile,{sessionId:session.id,...mutation(),characterId:session.guidance.guide.id,brain:brains[0],voice});
 await call(route(),mutation({action:'guidance',operation:'capture',payload:{text:'Discuss whether to fund a small pilot for a new community app. I want two advisers, an advocate and a sceptic, to examine costs and evidence gaps. Use a calm court hearing for ten minutes.'}}),'PATCH');
 await call('/api/ai/setup?profileId='+profile,{sessionId:session.id,...mutation()});assert.equal(session.guidance.setup.proposal.mode,'discussion');
 await call(route(),mutation({action:'guidance',operation:'confirm-notes',payload:{}}),'PATCH');
 let {library}=await call('/api/characters?profileId='+profile);const people=[];
 for(let i=0;i<2;i++){const c=generateCharacter(profile,{seed:i+1});c.name=i?'Bryn':'Elian';c.brain=brains[i];c.voice=voice;({library}=await call('/api/characters?profileId='+profile,{requestId:randomUUID(),expectedRevision:library.revision,action:'create',id:c.id,character:characterFields({name:c.name,avatar:c.avatar,personality:c.personality,code:c.code,voicePreference:c.voicePreference}),assignment:{brain:c.brain,voice:c.voice}}));people.push(c);}
 await call(route(),mutation({action:'roster',entries:people.map((c,i)=>({characterId:c.id,role:i?'Sceptic: test the costs and evidence':'Advocate: explore the benefits while answering objections'}))}),'PATCH');
 await call(route(),mutation({action:'guidance',operation:'approve',payload:{}}),'PATCH');
 const control=fields=>call(`/api/discussion/${session.id}/control?profileId=${profile}`,mutation(fields));const turn=()=>call(`/api/discussion/${session.id}/turn?profileId=${profile}`,mutation());
 await control({operation:'start'});await turn();await turn();
 await control({operation:'intervene',action:'challenge',text:'Challenge the most recent actual argument. Cite that contribution and ask its author one specific question.',characterId:people[0].id});await control({operation:'resume'});await turn();
 await control({operation:'intervene',action:'say',text:'Answer the challenge in the latest contribution directly. Cite that contribution and state whether your position changes.',characterId:people[1].id});await control({operation:'resume'});await turn();
 const turns=session.contributions.filter(c=>c.discussion);assert.equal(turns.length,4);assert.ok(turns[2].relatedIds.includes(turns[1].id));assert.ok(turns[3].relatedIds.includes(turns[2].id));assert.equal(new Set(turns.map(c=>c.brain.provider)).size,2);await control({operation:'finish'});
 console.log(JSON.stringify({liveDiscussion:true,turns:turns.map(c=>({id:c.id,brain:c.brain,turnKind:c.turnKind,relatedIds:c.relatedIds})),interventions:session.discussion.interventions.length,status:session.status,partialSummarySaved:session.outcomes.length>0}));
}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});assert.ok(root.startsWith(path.join(tmpdir(),'goc-live-discussion-')));await rm(root,{recursive:true,force:true});}
