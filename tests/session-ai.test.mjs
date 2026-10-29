import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {createSessionAI}from'../server/session-ai.mjs';
import {writerSchema,writerSceneBudget} from '../server/studio-writer.mjs';
import {generateCharacter}from'../shared/character-domain.mjs';
import {createSession,assignCharacter,applyCharacter,recordExchange,cancelPending,updateRoster}from'../shared/session-domain.mjs';
const brain={provider:'openai',model:'gpt-test'},voice={provider:'browser',id:'default'};
const mutation=s=>({requestId:randomUUID(),expectedRevision:s.revision});

test('Gemini accepts the complete scene shape without compiling nested array count bounds',async()=>{
 const cast=['host','regular','rotating','guest-1'].map((slotId,i)=>({slotId,characterId:'person-'+i})),schema=writerSchema(cast,writerSceneBudget({cast,initial:true,maxDialogueLines:32})),original=structuredClone(schema),requests=[];
 const ai=createSessionAI({env:{GEMINI_API_KEY:'fixture'},transport:async(url,options)=>{
  if(url.includes('models?pageSize'))return Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}]});
  const body=JSON.parse(options.body);requests.push(body);const sent=body.generationConfig.responseJsonSchema;
  const check=node=>{if(!node||typeof node!=='object')return;if(node.type==='array'){assert.ok(!Object.hasOwn(node,'maxItems'));assert.ok(!Object.hasOwn(node,'minItems'));}for(const child of Object.values(node))check(child);};check(sent);
  assert.match(sent.properties.lines.description,/At most 32 items/);assert.match(sent.properties.sceneCraft.properties.characterBeats.description,/At least 4 items/);assert.deepEqual(sent.properties.lines.items.properties.characterId.enum,cast.map(member=>member.characterId));
  return Response.json({modelVersion:'gemini-4-argon',candidates:[{content:{parts:[{text:'{}'}]}}]});
 }});
 const result=await ai.writeStudio(randomUUID(),{provider:'gemini',model:'gemini-4-argon'},{language:{primary:'hi-IN'}},schema);assert.equal(result.brain.model,'gemini-4-argon');assert.equal(requests.length,1);assert.deepEqual(schema,original);assert.equal(schema.properties.lines.maxItems,32);
});

test('a rejected provider request reports safe diagnostics and identifies the failing provider',async()=>{
 const diagnostics=[],key='fixture-secret-not-for-logs',ai=createSessionAI({env:{GEMINI_API_KEY:key},onProviderError:info=>diagnostics.push(info),transport:async url=>url.includes('models?pageSize')?Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}] }):Response.json({error:{code:400,status:'INVALID_ARGUMENT',message:'Request contains private prompt text '+key}},{status:400})});
 await assert.rejects(ai.writeStudio(randomUUID(),{provider:'gemini',model:'gemini-4-argon'},{language:{primary:'hi-IN'}},{type:'object'}),error=>error.code==='AI_REQUEST_REJECTED'&&/Gemini/.test(error.message)&&!error.message.includes(key));
 assert.deepEqual(diagnostics,[{provider:'Gemini',model:'gemini-4-argon',status:400,code:'INVALID_ARGUMENT',parameter:undefined}]);assert.ok(!JSON.stringify(diagnostics).includes(key));
});

test('Gemini billing denial is actionable, private, and retries the selected model after billing is restored',async()=>{
 const key='fixture-private-key',diagnostics=[];let restored=false,posts=0;
 const ai=createSessionAI({env:{GEMINI_API_KEY:key},onProviderError:d=>diagnostics.push(d),transport:async url=>{
  if(url.includes('models?pageSize'))return Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}]});
  posts++;return restored?Response.json({modelVersion:'gemini-4-argon',candidates:[{content:{parts:[{text:'{}'}]}}]}):Response.json({error:{status:'PERMISSION_DENIED',message:'Your billing account has an outstanding balance. Private data '+key}},{status:403});
 }}),call=()=>ai.writeStudio(randomUUID(),{provider:'gemini',model:'gemini-4-argon'},{language:{primary:'hi-IN'}},{type:'object'});
 await assert.rejects(call(),error=>error.code==='AI_BILLING_BLOCKED'&&/Gemini.*outstanding balance/.test(error.message)&&/Google AI Studio/.test(error.message)&&/saved draft and reviewer feedback/.test(error.message)&&!error.message.includes(key));assert.equal(posts,1);assert.ok(!JSON.stringify(diagnostics).includes(key));
 restored=true;assert.equal((await call()).brain.model,'gemini-4-argon');assert.equal(posts,2);
});

test('authentication and other permission failures identify the provider without exposing raw provider text',async()=>{
 for(const status of [401,403]){const ai=createSessionAI({env:{GEMINI_API_KEY:'fixture'},onProviderError:()=>{},transport:async url=>url.includes('models?pageSize')?Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}] }):Response.json({error:{status:'PERMISSION_DENIED',message:'Private provider response'}},{status})});
  await assert.rejects(ai.writeStudio(randomUUID(),{provider:'gemini',model:'gemini-4-argon'},{language:{primary:'hi-IN'}},{type:'object'}),error=>error.code===(status===401?'AI_AUTHENTICATION_FAILED':'AI_ACCESS_DENIED')&&/Gemini/.test(error.message)&&/Settings/.test(error.message)&&!error.message.includes('Private provider response'));
 }
});

test('studio comedy writing reaches the provider without turning factual formats into invented satire',async()=>{
 const requests=[];const ai=createSessionAI({env:{OPENAI_API_KEY:'fixture'},transport:async(url,options)=>{if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-test'}]});requests.push(JSON.parse(options.body));return Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:'{}'}]}]});}});
 const profile=randomUUID(),actor={...generateCharacter(profile),brain};
 for(const format of ['deadpan-meme','funny-news','serious-news'])await ai.studioTurn(profile,actor,{format,yourSlotId:'regular',turnIndex:2,segment:'panel',language:{primary:'hi-IN',codeSwitching:true}},{type:'object'},new AbortController().signal);
 const prompts=requests.map(request=>JSON.stringify(request));
 assert.match(prompts[0],/Stay in the fictional world/);assert.match(prompts[0],/panel slots do not override personality/);assert.match(prompts[0],/Character biography determines manner/);
 assert.match(prompts[1],/Never invent allegations/);assert.doesNotMatch(prompts[1],/Invent small clearly fictional scene details/);
 assert.doesNotMatch(prompts[2],/Comedy writing direction/);
});
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
 const profile=randomUUID(),character={...generateCharacter(profile),brain};const result=await ai.studioTurn(profile,character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal);
 assert.equal(result.brain.model,'gpt-test-snapshot');assert.equal(requests.filter(r=>r.url.endsWith('/responses')).length,1);assert.equal(JSON.parse(requests.at(-1).options.body).model,'gpt-test');
 const missing=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({output:[{content:[{type:'output_text',text:'Unattributed reply'}]}]})});await assert.rejects(missing.studioTurn(profile,character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal),/identify the response model/);
});
test('shutdown metadata excludes retired models before ranking and rejects saved assignments without substitution',async()=>{
 const today=new Date().toISOString().slice(0,10),future=new Date(Date.now()+86400000).toISOString().slice(0,10),calls=[];
 const ai=createSessionAI({env:{OPENAI_API_KEY:'fixture'},transport:async(url)=>{calls.push(url);assert.ok(url.endsWith('/models'));return Response.json({data:[{id:'o1',shutdown_date:'2026-10-23'},{id:'gpt-ending-today',shutdown_date:today},{id:'gpt-future-mini',shutdown_date:future},{id:'gpt-unknown',shutdown_date:null},{id:'gpt-missing-date'},{id:'gpt-invalid-date',shutdown_date:'unknown'}]});}});
 assert.deepEqual((await ai.catalog()).providers[0].models.map(m=>m.id).sort(),['gpt-future-mini','gpt-invalid-date','gpt-missing-date','gpt-unknown']);
 await assert.rejects(ai.validateAssignment({provider:'openai',model:'o1'},null),e=>e.code==='AI_MODEL_UNAVAILABLE'&&/o1 was shut down on 2026-10-23/.test(e.message));
 await ai.validateAssignment({provider:'openai',model:'gpt-future-mini'},null);assert.equal(calls.length,1);
});

test('model_not_found identifies the failing model, stops retries and never leaks provider text',async()=>{
 let posts=0;const ai=createSessionAI({env:{OPENAI_API_KEY:'fixture'},transport:async(url)=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):(posts++,Response.json({error:{code:'model_not_found',message:'Untrusted provider text secret-value'}},{status:404}))});
 const profile=randomUUID(),c={...generateCharacter(profile),brain},s={scenario:{situation:''},participants:[],exchanges:[]};
 for(let i=0;i<2;i++)await assert.rejects(ai.studioTurn(profile,c,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal),e=>e.code==='AI_MODEL_UNAVAILABLE'&&/gpt-test.*unavailable/.test(e.message)&&!e.message.includes('secret-value'));
 assert.equal(posts,1);assert.deepEqual((await ai.catalog()).providers[0].models,[]);
 const speech=createSessionAI({env:{OPENAI_API_KEY:'fixture'},transport:async(url)=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'},{id:'tts-1'}]}):Response.json({error:{code:'model_not_found'}},{status:404})});
 await assert.rejects(speech.speak(profile,{voice:{provider:'openai',id:'echo'}},'Hi',new AbortController().signal),e=>e.code==='AI_UNAVAILABLE'&&/404/.test(e.message));assert.equal((await speech.catalog()).providers[0].models[0].id,'gpt-test');
});
test('model budgets bound both one profile and the server across new profiles',async()=>{
 const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:'A bounded reply.'}]}]})});
 const profile=randomUUID(),character={...generateCharacter(profile),brain},session={scenario:{situation:''},participants:[],exchanges:[]};
 for(let i=0;i<10;i++)await ai.studioTurn(profile,character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal);
 await assert.rejects(ai.studioTurn(profile,character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal),/wait a moment/);
 for(let i=0;i<40;i++)await ai.studioTurn(randomUUID(),character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal);
 await assert.rejects(ai.studioTurn(randomUUID(),character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal),/server.*budget/);
});
test('a configured daily budget stops AI requests across profiles',async()=>{
 const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only',SOVEREIGN_DAILY_AI_REQUESTS:'3'},transport:async url=>url.endsWith('/models')?Response.json({data:[{id:'gpt-test'}]}):Response.json({model:'gpt-test',output:[{content:[{type:'output_text',text:'A bounded reply.'}]}]})});
 const character={...generateCharacter(randomUUID()),brain},session={scenario:{situation:''},participants:[],exchanges:[]};
 for(let i=0;i<3;i++)await ai.studioTurn(randomUUID(),character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal);
 await assert.rejects(ai.studioTurn(randomUUID(),character,{language:{primary:'en-IN'}},{type:'object'},new AbortController().signal),/daily AI budget/);
});
test('Gemini studio directions reserve a complete structured reply and use the supported thinking level',async()=>{
 const requests=[],models=['gemini-3.5-flash','gemini-3.8-flash'];
 const ai=createSessionAI({env:{GEMINI_API_KEY:'fixture'},transport:async(url,options)=>{
  if(url.includes('models?pageSize'))return Response.json({models:models.map(id=>({name:'models/'+id,supportedGenerationMethods:['generateContent']}))});
  requests.push(JSON.parse(options.body));return Response.json({modelVersion:models[requests.length-1],candidates:[{content:{parts:[{text:'{"summary":"Ready","commands":[]}'}]}}]});
 }});
 for(const model of models)await ai.directStudio(randomUUID(),{provider:'gemini',model},{instruction:'Close-up'},{type:'object'},new AbortController().signal);
 assert.equal(requests[0].generationConfig.thinkingConfig.thinkingLevel,'minimal');assert.equal(requests[1].generationConfig.thinkingConfig.thinkingLevel,'low');assert.ok(requests.every(r=>r.generationConfig.maxOutputTokens>=8192));
});
test('Grok uses its own catalogue and structured Responses API for the writer and director',async()=>{
 const sent=[],ai=createSessionAI({env:{XAI_API_KEY:'fixture-xai-private-key'},transport:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer fixture-xai-private-key');if(url==='https://api.x.ai/v1/models')return Response.json({data:[{id:'grok-fixture'},{id:'grok-imagine-image'},{id:'grok-voice-fixture'}]});assert.equal(url,'https://api.x.ai/v1/responses');const body=JSON.parse(options.body);sent.push(body);return Response.json({model:'grok-fixture-snapshot',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'{}'}]}]});}}),profile=randomUUID(),grok={provider:'xai',model:'grok-fixture'},schema={type:'object',properties:{},required:[],additionalProperties:false};
 const catalog=await ai.catalog();assert.deepEqual(catalog.providers.find(p=>p.id==='xai').models.map(m=>m.id),['grok-fixture']);assert.ok(!JSON.stringify(catalog).includes('fixture-xai-private-key'));
 const written=await ai.writeStudio(profile,grok,{adultComedy:true,language:{primary:'hi-IN'}},schema,new AbortController().signal);assert.deepEqual(written.brain,{provider:'xai',model:'grok-fixture-snapshot'});await ai.directStudio(profile,grok,{adultComedy:false},schema,new AbortController().signal);
 assert.equal(sent[0].store,false);assert.deepEqual(sent[0].text.format.schema,schema);assert.equal(sent[0].text.format.strict,true);assert.equal(sent[0].max_output_tokens,16384);assert.match(sent[0].input[0].content,/18\+ comedy is enabled/);assert.match(sent[0].input[0].content,/Preserve each actual character ID/);assert.match(sent[1].input[0].content,/18\+ comedy is disabled/);assert.match(sent[1].input[0].content,/no explicit sexual content or profanity/);
 await assert.rejects(ai.validateAssignment({provider:'xai',model:'grok-imagine-image'},null),/catalogue/);
 const missing=await createSessionAI({env:{},transport:()=>{throw Error('Must not call without a key');}}).catalog();assert.equal(missing.providers.find(p=>p.id==='xai').status,'No key configured');
});
test('Grok timeouts keep a useful resumable error instead of a generic scene failure',async()=>{
 const ai=createSessionAI({env:{XAI_API_KEY:'fixture'},transport:async(url)=>{if(url.endsWith('/models'))return Response.json({data:[{id:'grok-fixture'}]});throw new DOMException('Deadline exceeded','TimeoutError');}});
 await assert.rejects(ai.writeStudio(randomUUID(),{provider:'xai',model:'grok-fixture'},{language:{primary:'hi-IN'}},{type:'object'},new AbortController().signal),error=>error.code==='AI_TIMEOUT'&&error.status===504&&/Resume retries/.test(error.message));
});
test('Grok scene writing uses balanced reasoning while review avoids the high default',async()=>{
 const requests=[],ai=createSessionAI({env:{XAI_API_KEY:'fixture'},transport:async(url,options)=>{if(url.endsWith('/models'))return Response.json({data:[{id:'grok-4.7'},{id:'grok-4.20-0309-non-reasoning'}]});requests.push(JSON.parse(options.body));return Response.json({model:requests.at(-1).model,output:[{content:[{type:'output_text',text:'{}'}]}]});}}),profile=randomUUID(),schema={type:'object'};
 await ai.writeStudio(profile,{provider:'xai',model:'grok-4.7'},{language:{primary:'hi-IN'}},schema,new AbortController().signal);await ai.reviewStudio(profile,{provider:'xai',model:'grok-4.7'},{},schema,new AbortController().signal);await ai.writeStudio(profile,{provider:'xai',model:'grok-4.20-0309-non-reasoning'},{language:{primary:'hi-IN'}},schema,new AbortController().signal);assert.equal(requests[0].reasoning.effort,'medium');assert.equal(requests[1].reasoning.effort,'low');assert.ok(!Object.hasOwn(requests[2],'reasoning'));
});

test('Claude scene output leaves room for reasoning plus Hindi JSON and reports truncation explicitly',async()=>{
 let truncated=false;const bodies=[],ai=createSessionAI({env:{ANTHROPIC_API_KEY:'fixture'},transport:async(url,options)=>{if(url.includes('/models'))return Response.json({data:[{id:'claude-fixture'}]});bodies.push(JSON.parse(options.body));return Response.json({model:'claude-fixture',stop_reason:truncated?'max_tokens':'end_turn',content:[{type:'text',text:truncated?'{"lines":[':'{}'}]});}}),profile=randomUUID(),brain={provider:'anthropic',model:'claude-fixture'};
 await ai.writeStudio(profile,brain,{language:{primary:'hi-IN'}},{type:'object'});assert.equal(bodies[0].max_tokens,16384);await ai.reviewStudio(profile,brain,{}, {type:'object'});assert.equal(bodies[1].max_tokens,8192);truncated=true;await assert.rejects(ai.writeStudio(profile,brain,{language:{primary:'hi-IN'}},{type:'object'}),error=>error.code==='AI_OUTPUT_LIMIT'&&/saved work is kept/.test(error.message));
});

test('longer studio writing retains the full response and adapts array bounds for Claude without mutating the host schema',async()=>{
 const schema={type:'object',properties:{introductions:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},lines:{type:'array',minItems:4,maxItems:32,items:{type:'string'}}},required:['introductions','lines'],additionalProperties:false},before=structuredClone(schema),output=JSON.stringify({introductions:['host','one','two','three'],lines:Array.from({length:24},(_,i)=>'हिन्दी संवाद '+i+' '+('पूरा संवाद सुरक्षित रहे। '.repeat(26)))}),bodies=[];
 const ai=createSessionAI({env:{ANTHROPIC_API_KEY:'fixture'},transport:async(url,options)=>{if(url.includes('/models'))return Response.json({data:[{id:'claude-fixture'}]});bodies.push(JSON.parse(options.body));return Response.json({model:'claude-fixture',stop_reason:'end_turn',content:[{type:'text',text:output}]});}});
 const result=await ai.writeStudio(randomUUID(),{provider:'anthropic',model:'claude-fixture'},{language:{primary:'hi-IN'}},schema);
 assert.ok(output.length>12000);assert.equal(result.text,output);assert.equal(bodies[0].max_tokens,16384);
 const sent=bodies[0].output_config.format.schema;assert.equal(sent.properties.lines.minItems,1);assert.ok(!Object.hasOwn(sent.properties.lines,'maxItems'));assert.match(sent.properties.lines.description,/At most 32/);assert.deepEqual(schema,before);
});
