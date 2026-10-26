import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import {tmpdir}from'node:os';import path from'node:path';import http from'node:http';
import {createSessionAI}from'../server/session-ai.mjs';
import {createSessionService}from'../server/sessions.mjs';
import {generateCharacter}from'../shared/character-domain.mjs';
import {createSession,assignCharacter,applyCharacter,recordExchange,cancelPending,updateRoster}from'../shared/session-domain.mjs';
const brain={provider:'openai',model:'gpt-test'},voice={provider:'browser',id:'default'};
const mutation=s=>({requestId:randomUUID(),expectedRevision:s.revision});
test('brain swaps preserve identity, role, position, code and committed model provenance',()=>{
 const profile=randomUUID(),guide=generateCharacter(profile,{guide:true}),cast=generateCharacter(profile);
 let s=createSession({profileId:profile,requestId:randomUUID(),draft:{title:'Test',mode:'discussion',situation:'An actual question'},guide});
 s=updateRoster(s,{...mutation(s),entries:[{characterId:cast.id,role:'Critic',code:'Session priority'}]},[cast]);
 const before=structuredClone(s.characters[0]);s=assignCharacter(s,{...mutation(s),characterId:cast.id,brain,voice});
 const operation={...mutation(s),characterId:cast.id,epoch:s.epoch,userText:'Why?',text:'Because of the evidence.',brain:{provider:'openai',model:'gpt-test-actual'}};
 s=recordExchange(s,operation);assert.equal(recordExchange(s,operation),s);assert.equal(s.contributions[0].brain.model,'gpt-test-actual');
 s=assignCharacter(s,{...mutation(s),characterId:cast.id,brain:{provider:'anthropic',model:'claude-test'},voice});
 assert.equal(s.characters[0].id,before.id);assert.deepEqual(s.characters[0].avatar,before.avatar);assert.equal(s.participants[0].role,'Critic');assert.equal(s.participants[0].code,'Session priority');assert.equal(s.exchanges[0].brain.model,'gpt-test-actual');assert.equal(s.participants[0].brain.provider,'anthropic');
 const appearance=structuredClone(cast);appearance.name='An edited identity';appearance.avatar.attributes.hair='swept';const change=mutation(s);s=applyCharacter(s,change,appearance);assert.equal(s.characters[0].name,'An edited identity');assert.equal(s.characters[0].brain.provider,'anthropic');assert.equal(s.participants[0].code,'Session priority');assert.equal(s.exchanges[0].brain.model,'gpt-test-actual');assert.equal(applyCharacter(s,change,appearance),s);
});
test('cancelled/stale replies cannot be committed and sessions enforce a durable reply budget',()=>{
 const profile=randomUUID(),guide={...generateCharacter(profile,{guide:true}),brain,voice};let s=createSession({profileId:profile,guide,requestId:randomUUID(),draft:{title:'Budget',mode:'discussion',situation:''}});
 const stale={...mutation(s),characterId:guide.id,userText:'Hi',text:'Hello',brain,epoch:s.epoch};s=cancelPending(s,mutation(s));assert.throws(()=>recordExchange(s,stale),/changed/);
 for(let i=0;i<30;i++)s=recordExchange(s,{...mutation(s),characterId:guide.id,userText:'Question '+i,text:'Answer '+i,brain,epoch:s.epoch});
 assert.throws(()=>recordExchange(s,{...mutation(s),characterId:guide.id,userText:'More',text:'No',brain,epoch:s.epoch}),/30-reply/);
});
test('catalogues use real provider metadata, reject unavailable assignments and never substitute models',async()=>{
 const requests=[];const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only',ELEVENLABS_API_KEY:'test-only'},transport:async(url,options)=>{requests.push({url,options});if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-test'},{id:'tts-1'},{id:'whisper-1'},{id:'image-only'}]});if(url.includes('/v2/voices'))return Response.json({detail:{status:'missing_permissions'}},{status:401});if(url.endsWith('/responses'))return Response.json({model:'gpt-test-snapshot',output:[{content:[{type:'output_text',text:'A real attributed answer.'}]}]});throw Error('Unexpected endpoint');}});
 const c=await ai.catalog();assert.equal(c.providers[0].models[0].id,'gpt-test');assert.equal(c.voices[0].provider,'openai');assert.match(c.voiceStatus,/voices_read/);
 await assert.rejects(ai.validateAssignment({provider:'openai',model:'unavailable'},null),/catalogue/);
 const profile=randomUUID(),character={...generateCharacter(profile),brain};const result=await ai.talk(profile,character,{scenario:{situation:'Context'},participants:[],exchanges:[]},'Question',new AbortController().signal);
 assert.equal(result.brain.model,'gpt-test-snapshot');assert.equal(requests.filter(r=>r.url.endsWith('/responses')).length,1);assert.equal(JSON.parse(requests.at(-1).options.body).model,'gpt-test');
 const missing=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({output:[{content:[{type:'output_text',text:'Unattributed reply'}]}]})});await assert.rejects(missing.talk(profile,character,{scenario:{situation:''},participants:[],exchanges:[]},'Question',new AbortController().signal),/identify the response model/);
});
test('avatar proposals are validated as cosmetics and transcription preserves the actual audio format',async()=>{
 let fileName;const profile=randomUUID(),base=generateCharacter(profile);
 const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async(url,options)=>{if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-test'},{id:'whisper-1'}]});if(url.endsWith('/responses'))return Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:JSON.stringify({name:'Ari',personality:'Calm',code:'Check evidence',attributes:base.avatar.attributes})}]}]});if(url.endsWith('/transcriptions')){fileName=options.body.get('file').name;return Response.json({text:'Hello'});}throw Error('Unexpected endpoint');}});
 const proposal=await ai.avatar(profile,'A calm person',brain,new AbortController().signal);assert.equal(proposal.fields.name,'Ari');assert.deepEqual(Object.keys(proposal.fields).sort(),['name','personality','code','avatar','voicePreference'].sort());
 assert.equal((await ai.transcribe(profile,Buffer.from('audio'),'audio/mpeg',new AbortController().signal)).text,'Hello');assert.equal(fileName,'voice.mp3');
});
test('model budgets bound both one profile and the server across new profiles',async()=>{
 const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:'A bounded reply.'}]}]})});
 const profile=randomUUID(),character={...generateCharacter(profile),brain},session={scenario:{situation:''},participants:[],exchanges:[]};
 for(let i=0;i<10;i++)await ai.talk(profile,character,session,'Question',new AbortController().signal);
 await assert.rejects(ai.talk(profile,character,session,'More',new AbortController().signal),/wait a moment/);
 for(let i=0;i<40;i++)await ai.talk(randomUUID(),character,session,'Question',new AbortController().signal);
 await assert.rejects(ai.talk(randomUUID(),character,session,'More',new AbortController().signal),/server.*budget/);
});
test('a configured daily budget stops AI requests across profiles',async()=>{
 const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only',SOVEREIGN_DAILY_AI_REQUESTS:'3'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:'A bounded reply.'}]}]})});
 const character={...generateCharacter(randomUUID()),brain},session={scenario:{situation:''},participants:[],exchanges:[]};
 for(let i=0;i<3;i++)await ai.talk(randomUUID(),character,session,'Question',new AbortController().signal);
 await assert.rejects(ai.talk(randomUUID(),character,session,'More',new AbortController().signal),/daily AI budget/);
});
async function fixture(run){const root=await mkdtemp(path.join(tmpdir(),'goc-session-ai-'));let calls=0,finish;
 const ai={catalog:async()=>({providers:[],voices:[]}),validateAssignment:async(b)=>{if(b?.model!=='gpt-test')throw Error('Unknown model');},talk:async(profile,character,session,text,signal)=>{calls++;if(text==='wait')await new Promise(resolve=>{finish=resolve;});return{text:'Reply from '+character.name,brain:{provider:'openai',model:'gpt-test-actual'}};},speak:async()=>({audio:'AA==',mime:'audio/mpeg'})};
 let service=createSessionService({root,ai});const server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,profile=randomUUID();
 const call=async(route,method='GET',body,headers={})=>{const response=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
 const url='/api/sessions?profileId='+profile,id=randomUUID();let response=await call(url,'POST',{id,requestId:randomUUID(),draft:{title:'Talk',mode:'discussion',situation:'Test'}});const session=response.data.session;
 const action=(name,body,p=profile)=>call('/api/ai/'+name+'?profileId='+p,'POST',body);
 try{await run({profile,session,call,action,getCalls:()=>calls,release:()=>finish?.(),restart:()=>service=createSessionService({root,ai})});}finally{finish?.();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-session-ai-'));await rm(root,{recursive:true,force:true});}}
test('HTTP conversations persist, retry once, retain provenance after restart and stay profile scoped',async()=>fixture(async({profile,session,action,call,getCalls,restart})=>{
 let result=await action('assign',{sessionId:session.id,...mutation(session),characterId:session.guidance.guide.id,brain,voice});assert.equal(result.status,200);const assigned=result.data.session;
 const body={sessionId:assigned.id,...mutation(assigned),characterId:session.guidance.guide.id,text:'Hello'};result=await action('talk',body);assert.equal(result.status,200);assert.equal(result.data.session.exchanges[0].brain.model,'gpt-test-actual');assert.equal((await action('talk',body)).data.replayed,true);assert.equal(getCalls(),1);
 restart();assert.equal((await action('talk',body)).data.replayed,true);assert.equal(getCalls(),1);assert.equal((await action('talk',body,randomUUID())).status,404);
 assert.equal((await call('/api/ai/talk?profileId='+profile,'POST',body,{Origin:'https://elsewhere.example'})).status,403);
}));
test('HTTP interruption remains available during inference and rejects late output',async()=>fixture(async({session,action,call,profile,release})=>{
 const assigned=(await action('assign',{sessionId:session.id,...mutation(session),characterId:session.guidance.guide.id,brain,voice})).data.session;
 const pending=action('talk',{sessionId:session.id,...mutation(assigned),characterId:session.guidance.guide.id,text:'wait'});
 await new Promise(resolve=>setTimeout(resolve,40));
 const stopped=await call(`/api/sessions/${session.id}?profileId=${profile}`,'PATCH',{...mutation(assigned),action:'cancel'});assert.equal(stopped.status,200);release();assert.equal((await pending).status,409);
 const loaded=(await call(`/api/sessions/${session.id}?profileId=${profile}`)).data.session;assert.equal(loaded.exchanges,undefined);assert.equal(loaded.epoch,assigned.epoch+1);
}));
