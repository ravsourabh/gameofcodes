
const editorReview=(value)=>{const failed=['balanced','fresh','coherent','responsive','earnedEnding','inCharacter'].some(key=>value[key]===false);return {...value,verdict:failed?'revise':'approve',issues:failed?[{lineNumbers:[2],category:'continuity',severity:'required',problem:value.reason,instruction:value.reason}]:[],preserveLines:[]};};
import {SHOW_OPENING,showOpening} from '../shared/studio/show.mjs';
import {attentionSample} from '../shared/studio/attention.mjs';
import {validateDirection,directorCapabilities} from '../shared/studio/orchestration.mjs';
import {deliveryPause} from '../shared/studio/delivery.mjs';
import {facialReactionSample} from '../shared/studio/faces.mjs';
import {normaliseWriterScene} from '../server/studio-writer.mjs';
import {SessionError} from '../shared/session-domain.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {createStudioService} from '../server/studio-service.mjs';import {createCharacterLibrary} from '../server/character-library.mjs';import {createStudioSpeech,wavInfo} from '../server/studio-speech.mjs';import {lipSample} from '../shared/studio/lips.mjs';import {CORE_ACTIONS,performanceCatalogue,performanceSample} from '../shared/studio/performance.mjs';import {episodeInput} from '../shared/studio/episodes.mjs';
import {activeTurns,validateStudioReply} from '../shared/studio/production.mjs';
import {approvedSceneHistory} from '../shared/studio/story-history.mjs';
export function wav(durationMs=800){const data=Buffer.alloc(durationMs*48),bytes=Buffer.alloc(44+data.length);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data.length,40);return bytes;}
async function fixture(run){const root=await mkdtemp(path.join(tmpdir(),'goc-studio-production-')),profile=randomUUID(),calls=[],errors=[];let speakCount=0,held=null;
  const ai={catalog:async()=>({providers:['openai','gemini','anthropic'].map(id=>({id,models:[{id:id+'-fixture'}]}))}),validateAssignment:async()=>{},studioTurn:async(p,actor,input)=>{calls.push({actor:structuredClone(actor),input:structuredClone(input)});if(held)return held(p,actor,input);return {brain:actor.brain,text:JSON.stringify({text:`यह एक उपयोगी सुझाव है। हम अगला कदम ध्यान से लेंगे। ${input.latestContribution?'Building on that: ':''}${['An offline pause can protect attention.','The mindfulness break belongs between attempts.','Keep LeetCode progress on device and remove interruptions.','Try a quiet ten minute interval.','Let users choose their interval.','The committee approves a meeting with itself.'][calls.length%6]} ${input.opening?input.opening.panel.map(member=>member.name).join(' और '):''}`,respondsTo:input.latestContribution?.id||null,onTopic:true,cues:[],...(input.opening?{introducedCharacterIds:input.opening.panel.map(member=>member.id)}:{})})};},speak:async()=>{speakCount++;return {audio:wav().toString('base64'),mime:'audio/wav'};}};
  const speech=createStudioSpeech({root,ai,align:async()=>({mouthCues:[{start:0,end:.15,value:'X'},{start:.15,end:.3,value:'A'},{start:.3,end:.65,value:'E'},{start:.65,end:.8,value:'X'}]})});
  const characters=createCharacterLibrary({root});let service=createStudioService({root,ai,speech,characters,onError:e=>errors.push(e)});const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://local')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,method='GET',input)=>{const res=await fetch(`${origin}/api/studio/${route}${route.includes('?')?'&':'?'}profileId=${profile}`,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,...await res.json()};};
  const tokens=record=>({requestId:randomUUID(),expectedRevision:record.revision,expectedEpoch:record.epoch});
  const boot=async()=>{const made=await call('channels','POST',{id:randomUUID(),requestId:randomUUID(),templateId:'meme-radio'});assert.equal(made.status,201);const input=tokens(made.channel),result=await call(`channels/${made.channel.id}/produce`,'POST',input);assert.equal(result.status,200,JSON.stringify(result));return {...result,input};};
  const control=async(record,operation,extra={})=>{const response=await call(`episodes/${record.id}/production`,'POST',{...tokens(record),operation,...extra});assert.equal(response.status,200,JSON.stringify(response)+errors.map(e=>e.stack).join('\n'));return response;};
  try{await run({root,ai,speech,profile,calls,errors,call,tokens,boot,control,count:()=>speakCount,hold:fn=>held=fn,restart:()=>service=createStudioService({root,ai,speech,characters,onError:e=>errors.push(e)})});}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-studio-production-'));await rm(root,{recursive:true,force:true});}
}
test('zero-script start saves a cast once, with distinct brains and explicit V4 voices',()=>fixture(async({boot,call,restart})=>{const result=await boot();assert.equal(result.library.characters.length,3);assert.equal(new Set(result.library.characters.map(actor=>actor.brain.provider)).size,3);assert.ok(result.library.characters.every(actor=>actor.voice.model==='bulbul:v4-flash'));assert.equal(result.channel.setup.notes[0].source,'delegated');restart();const retry=await call(`channels/${result.channel.id}/produce`,'POST',result.input);assert.equal(retry.replayed,true);assert.equal(retry.library.characters.length,3);assert.equal(retry.episode.id,result.episode.id);}));
test('each assigned actor receives actual prior replies; receipts and corrected offline/mindfulness premise persist',()=>fixture(async({boot,control,call,tokens,calls,restart})=>{let {episode}=await boot();episode=(await control(episode,'start',{turnLimit:3})).episode;let firstInput;
  for(let i=0;i<3;i++){const input={...tokens(episode),operation:'turn'};const result=await call(`episodes/${episode.id}/production`,'POST',input);assert.equal(result.status,200,JSON.stringify(result));episode=result.episode;if(!i)firstInput=input;assert.equal(calls[i].input.history.length,i);if(i)assert.equal(calls[i].input.latestContribution.id,episode.production.turns[i-1].id);episode=(await control(episode,'played',{turnId:episode.production.awaitingPlayback,captions:true})).episode;}
  assert.equal(episode.production.status,'completed');assert.equal(new Set(calls.map(call=>call.actor.brain.provider)).size,3);restart();const retry=await call(`episodes/${episode.id}/production`,'POST',firstInput);assert.equal(retry.replayed,true);assert.equal(calls.length,3);
  const raw=episodeInput(episode.plan);delete raw.id;raw.premise='Correction: an offline mindfulness LeetCode companion, never a news committee.';raw.beats=[];episode=(await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'revise',plan:raw})).episode;episode=(await control(episode,'start',{turnLimit:2})).episode;episode=(await control(episode,'turn')).episode;assert.equal(calls.at(-1).input.premise,raw.premise);assert.equal(calls.at(-1).input.history.length,0);assert.equal(episode.production.turns.at(-1).respondsTo,null);assert.equal(episode.production.turns.length,4);
}));
test('pause invalidates a late independent model response without committing a fabricated line',()=>fixture(async({boot,control,call,tokens,hold,calls})=>{let {episode}=await boot();episode=(await control(episode,'start')).episode;let release;hold(async(p,actor,input)=>new Promise(resolve=>release=()=>resolve({brain:actor.brain,text:JSON.stringify({text:'A stale contribution.',respondsTo:null,onTopic:true,cues:[]})})));const pending=call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'turn'});while(!calls.length)await new Promise(resolve=>setTimeout(resolve,10));episode=(await control(episode,'pause')).episode;release();assert.equal((await pending).status,409);const saved=(await call(`episodes/${episode.id}`)).episode;assert.equal(saved.production.turns.length,0);assert.equal(saved.production.status,'paused');}));
test('authored lines lock and replay without model generation; editing preserves the original saved performance',()=>fixture(async({boot,control,calls})=>{let {episode}=await boot();const actor=episode.plan.cast[1].characterId,id=randomUUID();episode=(await control(episode,'edit-line',{beatId:id,characterId:actor,text:'This meeting could have been a nap.',segment:'panel',locked:true})).episode;episode=(await control(episode,'start',{mode:'hybrid'})).episode;episode=(await control(episode,'turn')).episode;assert.equal(calls.length,0);assert.equal(episode.production.turns[0].source,'authored');assert.equal(episode.production.turns[0].text,'This meeting could have been a nap.');episode=(await control(episode,'edit-line',{beatId:id,characterId:actor,text:'The nap has requested a committee.',segment:'panel',locked:true})).episode;assert.equal(episode.production.turns[0].text,'This meeting could have been a nap.');assert.equal(episode.production.edits.length,2);}));
test('speech cache binds final WAV and mouth timings; replay and request retry never pay twice',()=>fixture(async({boot,control,call,tokens,count,restart})=>{let {episode}=await boot();episode=(await control(episode,'start')).episode;episode=(await control(episode,'turn')).episode;const input={...tokens(episode),operation:'voice',turnId:episode.production.awaitingPlayback};const result=await call(`episodes/${episode.id}/production`,'POST',input);assert.equal(result.status,200,JSON.stringify(result));assert.equal(count(),1);assert.equal(result.asset.durationMs,800);assert.equal(result.asset.voice.model,'bulbul:v4-flash');restart();const replay=await call(`episodes/${episode.id}/production`,'POST',input);assert.equal(replay.status,200);assert.equal(count(),1);const stored=await call('audio/'+result.asset.id);assert.deepEqual(stored.asset.lips,result.asset.lips);assert.equal(lipSample(stored.asset.lips,200).visemes.AA_VI_01_PP,1);assert.equal(lipSample(stored.asset.lips,450).visemes.AA_VI_13_O,.8);assert.equal(lipSample(stored.asset.lips,450,{playing:false}).open,0);assert.equal(lipSample(stored.asset.lips,900).open,0);}));
test('captions can return to saved voices without generating dialogue again',()=>fixture(async({boot,control,calls,count})=>{
  let {episode}=await boot();episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
  for(let i=0;i<3;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
  episode=(await control(episode,'ready',{captions:true})).episode;
  const run=episode.production.runId,texts=activeTurns(episode.production).map(turn=>turn.text);
  episode=(await control(episode,'prepare-voices')).episode;
  for(const turn of activeTurns(episode.production))episode=(await control(episode,'voice',{turnId:turn.id})).episode;
  episode=(await control(episode,'ready')).episode;
  assert.equal(episode.production.runId,run);assert.equal(calls.length,3);assert.equal(count(),3);
  assert.deepEqual(activeTurns(episode.production).map(turn=>turn.text),texts);
  episode=(await control(episode,'prepare-voices')).episode;
  for(const turn of activeTurns(episode.production))episode=(await control(episode,'voice',{turnId:turn.id})).episode;
  assert.equal(count(),3);
}));
test('a voice preference change changes the audio cache key and final silence closes immediately',()=>fixture(async({boot,speech,count,profile})=>{const {library}=await boot(),actor=library.characters[0],language={primary:'hi-IN',codeSwitching:true};const a=await speech.prepare(profile,actor,'एक बार फिर।',language);const b=await speech.prepare(profile,{...actor,voicePreference:{style:'warm',pace:'relaxed'}},'एक बार फिर।',language);assert.notEqual(a.id,b.id);assert.equal(count(),2);assert.equal(wavInfo(Buffer.from(a.audio,'base64')).durationMs,800);assert.equal(lipSample(a.lips,700).open,0);}));
test('core readiness is per actual rig, remaining actions are visibly unavailable; motion seek and reduction are deterministic',()=>{const missing=performanceCatalogue('one');assert.equal(missing.filter(a=>a.status==='ready').length,0);const cues=[{id:'a',characterId:'one',actionId:'comedy.facepalm',atMs:100,durationMs:1000,intensity:.8}];assert.equal(performanceSample(cues,50,{characterId:'one'}).length,0);const full=performanceSample(cues,600,{characterId:'one'})[0],reduced=performanceSample(cues,600,{characterId:'one',reducedMotion:true})[0];assert.ok(reduced.intensity<full.intensity);assert.equal(performanceSample(cues,1200,{characterId:'one'}).length,0);assert.ok(CORE_ACTIONS.length>15);});
test('prepared production completes all conversation before voice, then lays out final audio without further inference',()=>fixture(async({boot,control,calls,count,call,tokens})=>{
  let {episode}=await boot();episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
  for(let i=0;i<3;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
  assert.equal(calls.length,3);assert.equal(count(),0);assert.equal(episode.production.phase,'voicing');
  for(const line of episode.production.turns)episode=(await control(episode,'voice',{turnId:line.id})).episode;
  assert.equal(count(),3);assert.deepEqual(episode.production.turns.map(turn=>turn.startMs),[0,800,1600]);
  episode=(await control(episode,'ready')).episode;assert.equal(episode.production.status,'completed');assert.equal(episode.production.phase,'ready');assert.equal(calls.length,3);
  const take=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'accept-take',takeId:randomUUID()});assert.equal(take.status,200,JSON.stringify(take));assert.deepEqual(take.episode.takes[0].productionSnapshot,episode.production);
  episode=take.episode;const original=activeTurns(episode.production),oldAudio=original.map(line=>line.voiceAssetId);
  episode=(await control(episode,'edit-line',{beatId:original[1].beatId,characterId:original[1].characterId,text:'सिर्फ इस पंक्ति को बदलें। बाकी बातचीत और आवाज़ सुरक्षित रखें।',segment:'panel',locked:true})).episode;
  const latest=activeTurns(episode.production);assert.equal(latest.length,3);assert.equal(latest[0].voiceAssetId,oldAudio[0]);assert.equal(latest[2].voiceAssetId,oldAudio[2]);assert.equal(latest[1].voiceAssetId,undefined);assert.equal(calls.length,3);
  episode=(await control(episode,'voice',{turnId:latest[1].id})).episode;assert.equal(count(),4);assert.equal(episode.takes[0].productionSnapshot.turns[1].voiceAssetId,oldAudio[1]);
}));
test('a director reaction replaces overlapping directions while unsupported actions leave state intact',()=>fixture(async({boot,control,call,tokens})=>{
  let {episode}=await boot();episode=(await control(episode,'start')).episode;episode=(await control(episode,'turn')).episode;const actor=episode.plan.cast[0].characterId,turnId=episode.production.awaitingPlayback;
  episode=(await control(episode,'cue',{turnId,characterId:actor,actionId:'response.nod',atMs:0})).episode;
  episode=(await control(episode,'cue',{turnId,characterId:actor,actionId:'comedy.facepalm',atMs:0})).episode;
  assert.deepEqual(episode.production.cues.filter(cue=>cue.triggerTurnId===turnId).map(cue=>cue.actionId),['comedy.facepalm']);
  const result=await call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'cue',turnId,characterId:actor,actionId:'unsupported.action',atMs:0});assert.equal(result.status,400);
  assert.equal((await call(`episodes/${episode.id}`)).episode.revision,episode.revision);
}));
test('guest reactions cannot happen before the guest entrance beat',()=>fixture(async({boot,control,call,tokens})=>{
  const booted=await boot(),[host,regular,guest]=booted.episode.plan.cast;const beats=[{id:'opening',segment:'setup',kind:'speech',speakerId:host.characterId,text:'पहले मेज़बान बोलेगा।'},{id:'guest',segment:'panel',kind:'speech',speakerId:guest.characterId,text:'अब मेहमान आया है।'},{id:'closing',segment:'payoff',kind:'speech',speakerId:host.characterId,text:'कार्यक्रम समाप्त हुआ।'}];
  const made=await call('episodes','POST',{id:randomUUID(),requestId:randomUUID(),channelId:booted.channel.id,plan:{premise:'A fictional guest visits.',writingMode:'hybrid',cast:[host,regular,{...guest,slotId:'guest-1',enterAtBeatId:'guest',leaveAfterBeatId:'guest'}],beats}});assert.equal(made.status,201,JSON.stringify(made));let episode=(await control(made.episode,'start')).episode;episode=(await control(episode,'turn')).episode;
  const early=await call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'cue',turnId:episode.production.awaitingPlayback,characterId:guest.characterId,actionId:'expression.smile'});assert.equal(early.status,400);
  episode=(await control(episode,'played',{turnId:episode.production.awaitingPlayback,captions:true})).episode;episode=(await control(episode,'turn')).episode;episode=(await control(episode,'cue',{turnId:episode.production.awaitingPlayback,characterId:guest.characterId,actionId:'expression.smile'})).episode;assert.equal(episode.production.cues.length,1);
}));

test('mouth-occupying directions require a listener and retain the saved speech',()=>fixture(async({boot,control,call,tokens})=>{
  let {episode}=await boot();episode=(await control(episode,'start',{prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;const line=episode.production.turns[0],original=structuredClone(episode.production.turns),listener=episode.plan.cast.find(member=>member.characterId!==line.characterId).characterId;
  for(const actionId of ['props.drink-water','fatigue.sleep-on-desk','fatigue.yawn']){const result=await call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'cue',turnId:line.id,characterId:line.characterId,actionId});assert.equal(result.status,400);assert.match(result.error,/listening character/);}
  episode=(await control(episode,'cue',{turnId:line.id,characterId:listener,actionId:'props.drink-water'})).episode;assert.equal(episode.production.cues.at(-1).actionId,'props.drink-water');assert.deepEqual(episode.production.turns,original);
}));

test('audition previews the selected voice without replacing the saved character',()=>fixture(async({boot,call})=>{
  const {library}=await boot(),actor=library.characters[0],voice={provider:'sarvam',model:'bulbul:v4-flash',id:'ratan_hi_latenight'};
  const result=await call('speech-preview','POST',{requestId:randomUUID(),characterId:actor.id,voice,language:{primary:'hi-IN',codeSwitching:true}});
  assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.asset.voice.id,voice.id);
  const saved=(await call('characters')).library.characters.find(person=>person.id===actor.id);assert.deepEqual(saved.voice,actor.voice);
}));
test('generated reactions are spaced within final audio instead of overlapping at line start',()=>fixture(async({boot,control,hold})=>{
  let {episode}=await boot();let n=0;
  hold(async(_p,actor,input)=>({brain:actor.brain,text:JSON.stringify({text:['ध्यान के लिए फोन बंद रखकर कागज पर अभ्यास करो।','पिछले प्रयास की भूल समझना अगली सफलता का आधार बनेगा।','समिति ने आखिर चाय पीकर बैठक समाप्त करने की अनुमति दी।'][n++%3],respondsTo:input.latestContribution?.id||null,onTopic:true,...(input.opening?{introducedCharacterIds:input.opening.panel.map(member=>member.id)}:{}),cues:[{characterId:actor.id,actionId:'speaking.explain-one-hand',intensity:.6},{characterId:actor.id,actionId:'speaking.open-palms',intensity:.5}]})}));
  episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
  for(let i=0;i<3;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
  const line=episode.production.turns[0];episode=(await control(episode,'voice',{turnId:line.id})).episode;
  const cues=episode.production.cues.filter(cue=>cue.triggerTurnId===line.id);
  assert.equal(cues.length,2);assert.ok(cues[1].atMs>cues[0].atMs);
  assert.ok(cues.every(cue=>cue.atMs>=0&&cue.atMs+cue.durationMs<=800));
}));

test('the host opening receives real panel names, roles, variation and earlier openings',()=>fixture(async({boot,control,calls})=>{
  let {episode,library}=await boot();episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
  episode=(await control(episode,'turn')).episode;
  const opening=calls[0].input.opening;
  assert.equal(opening.host.id,episode.plan.cast.find(member=>member.slotId==='host').characterId);
  assert.deepEqual(opening.panel.map(member=>member.name),library.characters.filter(actor=>actor.id!==opening.host.id).map(actor=>actor.name));
  for(const member of opening.panel)assert.ok(episode.production.turns[0].text.includes(member.name));assert.ok(opening.panel.every(member=>member.role));assert.ok(opening.variant);assert.deepEqual(opening.previousOpenings,[]);
  const previous=episode.production.turns[0].text;
  episode=(await control(episode,'pause')).episode;episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
  episode=(await control(episode,'turn')).episode;
  assert.ok(calls[1].input.opening.previousOpenings.includes(previous));
}));

test('director uses the saved model and known capabilities; receipts replay without another model call',()=>fixture(async({boot,call,tokens,ai})=>{
  let {channel,episode}=await boot();let count=0,context;
  ai.directStudio=async(_profile,brain,input)=>{count++;context=input;return {brain,text:JSON.stringify({summary:'Show a wide shot.',commands:[{kind:'shot',shot:'wide',characterId:null,actionId:null}]})};};
  const before=await call(`channels/${channel.id}/orchestrate`,'POST',{...tokens(channel),text:'Wide shot'});assert.equal(before.status,200);assert.equal(before.direction.brain.provider,'openai');assert.equal(count,1);channel=before.channel;count=0;
  channel=(await call('channels/'+channel.id,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,orchestrationBrain:{provider:'anthropic',model:'claude-fixture'}}})).channel;
  const input={...tokens(channel),episodeId:episode.id,episodeRevision:episode.revision,episodeEpoch:episode.epoch,text:'Show a wide shot'};
  const response=await call(`channels/${channel.id}/orchestrate`,'POST',input);assert.equal(response.status,200,JSON.stringify(response));assert.equal(count,1);assert.equal(response.direction.brain.provider,'anthropic');assert.equal(context.capabilities.commands.length,9);assert.equal(context.cast.length,3);assert.ok(context.cast.every(actor=>actor.name));
  const again=await call(`channels/${channel.id}/orchestrate`,'POST',input);assert.equal(again.replayed,true);assert.equal(count,1);assert.deepEqual(again.direction,response.direction);
  ai.directStudio=async()=>({brain:{provider:'anthropic',model:'claude-fixture'},text:JSON.stringify({summary:'Publish it',commands:[{kind:'publish',shot:null,characterId:null,actionId:null}]})});
  const bad=await call(`channels/${channel.id}/orchestrate`,'POST',{...tokens(response.channel),text:'Publish'});assert.equal(bad.status,502);
  assert.equal((await call('channels/'+channel.id)).channel.revision,response.channel.revision);
}));
test('a show changed during director inference rejects the stale plan',()=>fixture(async({boot,call,tokens,ai,control})=>{
  let {channel,episode}=await boot();channel=(await call('channels/'+channel.id,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,orchestrationBrain:{provider:'openai',model:'gpt-fixture'}}})).channel;
  episode=(await control(episode,'start',{prepareOnly:true})).episode;
  let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
  ai.directStudio=async()=>{started();await gate;return {brain:{provider:'openai',model:'gpt-fixture'},text:JSON.stringify({summary:'Wide shot',commands:[{kind:'shot',shot:'wide',characterId:null,actionId:null}]})};};
  const pending=call(`channels/${channel.id}/orchestrate`,'POST',{...tokens(channel),episodeId:episode.id,episodeRevision:episode.revision,episodeEpoch:episode.epoch,text:'Show a wide shot'});
  await ready;await control(episode,'pause');release();assert.equal((await pending).status,409);
  assert.equal((await call('channels/'+channel.id)).channel.directionHistory,undefined);
}));
test('Sarvam catalogue exposes all pinned voices and preserves explicit older selections',async()=>{
  const {V4_VOICES,V3_VOICES,sarvamVoice}=await import('../shared/studio/voices.mjs');
  assert.equal(V4_VOICES.length,222);assert.equal(V3_VOICES.length,37);assert.equal(new Set(V4_VOICES.map(voice=>voice.id)).size,222);
  assert.ok(V4_VOICES.filter(voice=>voice.languages.includes('hi-IN')).length>=129);
  assert.equal(sarvamVoice({provider:'sarvam',id:'shubh'},'hi-IN').model,'bulbul:v3');
  assert.throws(()=>sarvamVoice({provider:'sarvam',model:'bulbul:v4-flash',id:'shubh'},'hi-IN'));
});

test('a directed reaction stays inside its recorded line',()=>fixture(async({boot,control})=>{
  let {episode}=await boot();episode=(await control(episode,'start',{prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;
  const turn=episode.production.turns[0];episode=(await control(episode,'voice',{turnId:turn.id})).episode;
  episode=(await control(episode,'cue',{turnId:turn.id,characterId:turn.characterId,actionId:'response.nod',atMs:700,durationMs:1200})).episode;
  assert.equal(episode.production.cues.at(-1).durationMs,100);
}));
import {comicCharacterDetails,planBanter,applyBanter} from '../server/studio-banter.mjs';

test('character colour stays stable while conversational detours vary and retain every cast member',()=>{
  const cast=['host','regular','rotating','guest-1'].map((slotId,index)=>({slotId,characterId:'actor-'+index}));
  const profiles=new Set(),topics=new Set();let picked=0;
  for(let i=0;i<1000;i++){
    const runId='00000000-0000-4000-8000-'+String(i).padStart(12,'0'),args={runId,cast,turnCount:6,format:'deadpan-meme',mode:'improvised'},b=planBanter(args);
    assert.deepEqual(b,planBanter(args));const details=comicCharacterDetails(runId);assert.deepEqual(details,comicCharacterDetails(runId));profiles.add(JSON.stringify(details));
    if(!b)continue;picked++;topics.add(b.topic);assert.notEqual(b.initiatorId,'actor-0');assert.notEqual(b.targetId,b.initiatorId);
    const original=Array.from({length:6},(_,index)=>({source:'model',speakerId:cast[index===5?0:index%4].characterId})),beats=applyBanter(original,b);
    assert.equal(beats.length,6);assert.equal(beats[0].speakerId,'actor-0');assert.equal(beats[5].speakerId,'actor-0');assert.deepEqual(new Set(beats.map(beat=>beat.speakerId)),new Set(original.map(beat=>beat.speakerId)));
    assert.deepEqual(beats.slice(b.startIndex,b.startIndex+3).map(beat=>beat.speakerId),[b.initiatorId,b.targetId,b.initiatorId]);
  }
  assert.ok(picked>250&&picked<450);assert.equal(topics.size,5);assert.ok(profiles.size>990);
  const args={runId:'one',cast,turnCount:8,format:'deadpan-meme',mode:'improvised'};
  assert.equal(planBanter({...args,mode:'scripted'}),null);assert.equal(planBanter({...args,hasBeats:true}),null);assert.equal(planBanter({...args,format:'serious-news'}),null);assert.equal(planBanter({...args,turnCount:3}),null);assert.equal(planBanter({...args,cast:cast.slice(0,2)}),null);
});

test('a saved detour routes the question, real answer and callback across pauses without rerolling people',()=>fixture(async({boot,control,call,tokens,calls,restart})=>{
  let {episode}=await boot();let requestId;
  for(let i=0;i<100;i++){const candidate=randomUUID();if(planBanter({runId:candidate,cast:episode.plan.cast,turnCount:6,format:'deadpan-meme',mode:'improvised'})){requestId=candidate;break;}}
  assert.ok(requestId);episode=(await control(episode,'start',{requestId,prepareOnly:true})).episode;const b=structuredClone(episode.production.banter);assert.ok(b);
  for(let i=0;i<6;i++){
    episode=(await control(episode,'turn')).episode;const actual=calls.at(-1),turn=episode.production.turns.at(-1);
    assert.deepEqual(actual.input.comicCharacter,{origin:'optional generated fictional colour',...comicCharacterDetails(turn.characterId)});
    if(i>=b.startIndex&&i<=b.startIndex+2){assert.equal(actual.input.conversationDetour.stage,['ask','answer','connect'][i-b.startIndex]);assert.equal(actual.actor.id,i===b.startIndex+1?b.targetId:b.initiatorId);if(i>b.startIndex)assert.equal(actual.input.latestContribution.text,episode.production.turns.at(-2).text);}
    episode=(await control(episode,'drafted',{turnId:turn.id})).episode;
    if(i===b.startIndex){episode=(await control(episode,'pause')).episode;restart();episode=(await control(episode,'resume')).episode;assert.deepEqual(episode.production.banter,b);}
  }
  episode=(await control(episode,'ready',{captions:true})).episode;
  const result=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'accept-take',takeId:randomUUID()});assert.equal(result.status,200);assert.deepEqual(result.episode.takes[0].productionSnapshot.banter,b);assert.equal(calls.length,6);
}));

test('adaptive dialogue answers the requested speaker, lands naturally and continues without rewriting saved lines',()=>fixture(async({boot,control,hold,call,tokens})=>{
  let {episode}=await boot();let requestId;
  for(let i=0;i<100;i++){const candidate=randomUUID();if(!planBanter({runId:candidate,cast:episode.plan.cast,turnCount:12,format:'deadpan-meme',mode:'improvised'})){requestId=candidate;break;}}
  const target=episode.plan.cast.find(member=>member.slotId==='regular').characterId;
  hold(async(_p,actor,input)=>{return ({brain:actor.brain,text:JSON.stringify({text:['नमस्कार, मोहल्ले का कुत्ता जूते लेकर भाग गया।','आज चौकीदार ने सारी चप्पलें तिजोरी में रख दीं।','दुकानदार ने बिस्कुट का रेट बढ़ा दिया है।','पुलिस की सीटी सुनकर पूरा बाजार ठहर गया।','सबसे ज्यादा परेशान दर्जी है, उसकी गेंद खो गई।','निशा, तुम्हारे घर में कितनी घड़ियाँ लगी हैं?','मेरे घर में तीन घड़ियाँ हैं, तीनों अलग समय बताती हैं।','फिर तो चोर तुम्हारे घर से समय भी चुराकर ले गया।','अब चौक पर पहरेदारी की जिम्मेदारी बिल्ली को मिली है।','माली ने चोरी रोकने के लिए गमले गिनने शुरू किए।','अंत में गमलों में पौधे नहीं, चोरी हुए मोजे निकले।'][input.turnIndex],respondsTo:input.latestContribution?.id||null,onTopic:true,cues:[],...(input.opening?{introducedCharacterIds:input.opening.panel.map(member=>member.id)}:{}),conversation:{needsReply:input.turnIndex===5,landed:input.turnIndex===7||input.turnIndex>=10,nextSpeakerId:input.turnIndex===5?target:null}})});});
  episode=(await control(episode,'start',{requestId,adaptive:true,prepareOnly:true})).episode;assert.ok(episode.production.flow);
  for(let i=0;i<8;i++){episode=(await control(episode,'turn')).episode;if(i===6)assert.equal(episode.production.turns.at(-1).characterId,target);episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;if(i===5)assert.equal(episode.production.phase,'composing');}
  assert.equal(episode.production.cursor,8);assert.equal(episode.production.schedule.length,8);episode=(await control(episode,'ready',{captions:true})).episode;
  const before=structuredClone(episode.production.turns),runId=episode.production.runId;
  episode=(await control(episode,'continue')).episode;assert.equal(episode.production.runId,runId);
  for(let i=0;i<3;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
  assert.equal(episode.production.cursor,11);assert.equal(episode.production.phase,'voicing');assert.deepEqual(episode.production.turns.slice(0,8),before);
}));

test('Hindi introductions do not get a duplicate Latin-name greeting appended',()=>fixture(async({boot,control,hold})=>{
  let {episode}=await boot();hold(async(_p,actor,input)=>({brain:actor.brain,text:JSON.stringify({text:'नमस्कार, आज साथ हैं कबीर और निशा। मोहल्ले के कुत्ते ने बिस्कुट को हफ्ता मान लिया है।',respondsTo:null,onTopic:true,cues:[],introducedCharacterIds:input.opening.panel.map(member=>member.id)})}));
  episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;
  const text=episode.production.turns[0].text;assert.equal((text.match(/नमस्कार/g)||[]).length,1);assert.ok(!text.includes('Kabir'));assert.ok(!text.includes('आज हमारे साथ हैं'));
}));


test('Hindi callbacks retain vowel marks and are not rejected for sharing one noun',()=>{
 const previous={id:'previous',text:'माली ने चोरी रोकने के लिए गमले गिनने शुरू किए।'};
 const reply={text:'अंत में गमलों में पौधे नहीं, चोरी हुए मोजे निकले।',respondsTo:'previous',onTopic:true,cues:[]};
 assert.doesNotThrow(()=>validateStudioReply(reply,{last:previous,history:[previous]}));
 assert.throws(()=>validateStudioReply({...reply,text:previous.text},{last:previous,history:[previous]}),/new point/);
});
import {validateWriterScene} from '../server/studio-writer.mjs';
import {validateStaging,sparseStaging} from '../server/studio-staging.mjs';

test('one scene writer preserves all character profiles and voices; the director stages without rewriting dialogue',()=>fixture(async({boot,control,call,tokens,ai,calls})=>{
  let {episode,library}=await boot();const owner=library.characters[0];library=(await call('characters','POST',{requestId:randomUUID(),expectedRevision:library.revision,action:'update',id:owner.id,character:Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(key=>[key,owner[key]])),profile:{...owner.studioProfile,canon:[{id:randomUUID(),text:'PRIVATE_CANON_MUST_NOT_REACH_WRITER',visibility:'private',origin:'creator'}]},assignment:{brain:owner.brain,voice:owner.voice}})).library;const original=structuredClone(library.characters);let writes=0,stages=0,received,authoredTexts;
  ai.writeStudio=async(_profile,brain,input)=>{
    writes++;received=structuredClone(input);const ids=input.cast.map(member=>member.characterId),other=ids.filter(id=>id!==input.firstSpeakerId),order=[input.firstSpeakerId,other[0],other[1],other[0],other[1],input.firstSpeakerId];
    const lines=order.map((characterId,index)=>({characterId,text:['नमस्कार, आज मोहल्ले की बात करते हैं। हमारे साथ सभी मेहमान हैं।','तुम्हारे घर में कितनी घड़ियाँ लगी हैं?','तीन घड़ियाँ हैं, तीनों अलग समय बताती हैं।','तो चोर भी तुम्हारे यहाँ सही समय देखकर नहीं पहुँच सकता।','उसे पहले तीन घड़ियों की बैठक बुलानी पड़ेगी।','और बैठक शुरू होने से पहले ही तीनों की छुट्टी हो जाएगी।'][index],intent:index===0?'setup':index===1?'question':index===2?'answer':index===5?'closing':index===4?'payoff':'statement',targetId:index===1?other[1]:null,introducedCharacterIds:index===0?other:[],cues:[]}));
    authoredTexts=lines.map((line,index)=>index===0?showOpening(line.text):line.text);return {brain,text:JSON.stringify({summary:'A clock question leads to a neighbourhood callback.',lines})};
  };
  ai.stageStudio=async(_profile,brain,input)=>{stages++;assert.deepEqual(input.lines.map(line=>line.text),authoredTexts);return {brain,text:JSON.stringify({lines:input.lines.map((line,index)=>({lineIndex:index,shot:index===0?'close-up':index===2?'reaction':'auto',reactionCharacterId:index===2?input.cast.find(member=>member.characterId!==line.characterId).characterId:null,reactionActionId:index===2?'response.raise-eyebrow':null,atFraction:.65,intensity:.35}))})};};
  let requestId;for(let i=0;i<100;i++){const candidate=randomUUID();if(!planBanter({runId:candidate,cast:episode.plan.cast,turnCount:12,format:'deadpan-meme',mode:'improvised'})){requestId=candidate;break;}}
  episode=(await control(episode,'start',{requestId,prepareOnly:true,adaptive:true})).episode;
  for(let i=0;i<6;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
  assert.equal(writes,1);assert.equal(stages,1);assert.ok(!JSON.stringify(received).includes('PRIVATE_CANON_MUST_NOT_REACH_WRITER'));assert.equal(calls.length,0);assert.equal(episode.production.schedule.length,6);assert.equal(episode.production.phase,'voicing');
  for(const person of original){const packet=received.characters.find(packet=>packet.id===person.id);assert.equal(packet.personality,person.personality);assert.deepEqual(packet.profile.behaviour,person.studioProfile.behaviour);assert.deepEqual(packet.profile.psychology,person.studioProfile.psychology);assert.deepEqual(packet.profile.backstory,person.studioProfile.backstory);assert.ok(!('canon' in packet.profile));}
  assert.deepEqual((await call('characters')).library.characters,original);assert.ok(episode.production.cues.some(cue=>cue.actionId==='response.raise-eyebrow'));
  const before=episode.production.turns.map(turn=>turn.text);for(const turn of activeTurns(episode.production))episode=(await control(episode,'voice',{turnId:turn.id})).episode;episode=(await control(episode,'ready')).episode;
  assert.deepEqual(episode.production.turns.map(turn=>turn.text),before);assert.equal(writes,1);assert.equal(stages,1);
}));

test('writer rejects unanswerable exchanges and staging cannot replace spoken text',()=>{
  const cast=[{characterId:'a'},{characterId:'b'}],line=(id,text,intent='statement',targetId=null)=>({characterId:id,text,intent,targetId,introducedCharacterIds:id==='a'?['b']:[],cues:[]});
  const scene={summary:'A short question and callback.',lines:[line('a','Welcome to the programme.','setup'),line('b','Where did you put the keys?','question','a'),line('a','I left them in the umbrella.','answer'),line('b','Then the rain has the spare set.','payoff')]};
  assert.doesNotThrow(()=>validateWriterScene(scene,{cast,firstSpeakerId:'a',maxLines:12}));
  assert.throws(()=>validateWriterScene({...scene,lines:[...scene.lines.slice(0,2),line('b','I answered for you.'),scene.lines[3]]},{cast,firstSpeakerId:'a',maxLines:12}),/next reply/);
  assert.throws(()=>validateStaging({lines:[{lineIndex:0,shot:'speaker',reactionCharacterId:null,reactionActionId:null,atFraction:.5,intensity:0,text:'Replace the dialogue'}]},{cast,lines:scene.lines}));
});

test('resuming an older failed scene allows a complete longer conversation and separate introductions without truncating it',()=>fixture(async({boot,control,call,ai,root,profile,restart})=>{
  let {episode}=await boot();let writes=0,originalBody;
  ai.writeStudio=async(_profile,brain,input,schema)=>{
    writes++;const ids=input.cast.map(member=>member.characterId),host=input.hostId;
    assert.ok(input.dialogueMaxLines>12);assert.equal(input.maxLines,input.dialogueMaxLines+ids.length);
    assert.equal(schema.properties.lines.maxItems,input.dialogueMaxLines);assert.equal(schema.properties.introductions.maxItems,ids.length);
    const dialogue=['दुकान का ताला ग्राहक के पास मिला।','चाबी दुकानदार की जेब में है।','फिर वह कतार में क्यों खड़ा है।','उसे ग्राहक ने नंबर दिया है।','दुकान बंद है लेकिन नंबर चालू है।','पहला नंबर चाबी वाले का होना चाहिए।','कागज पर उसका नंबर आखिरी है।','कागज किसने लिखा था।','दुकानदार ने सुबह खुद लिखा था।','तब ग्राहक पहुँचे नहीं थे।','उसने अपना नंबर पहले ही काट दिया।','वह दुकान का मालिक है।','मालिक को ग्राहक नहीं माना जाएगा।','तब कतार में क्यों लगाया।','चाबी माँगने के लिए लगाया।','ग्राहक ने उसे चाबी वापस दे दी।','अब दुकानदार अपने ही ताले का ग्राहक है।','इसी कतार के साथ आज का कार्यक्रम समाप्त हुआ।'];
    originalBody=dialogue.map((text,index)=>({characterId:index===17?host:ids[index%ids.length],text,intent:index===17?'closing':index===16?'payoff':'statement',targetId:null,introducedCharacterIds:[],cues:[]}));
    return {brain,text:JSON.stringify({summary:'A complete longer dialogue.',detourUsed:false,introductions:ids.map(characterId=>({characterId,text:characterId===host?'आज चाबी के लिए दुकानदार कतार में है।':'हमारे साथ '+input.characters.find(person=>person.id===characterId).name+' हैं।'})),lines:originalBody})};
  };
  ai.stageStudio=async(_profile,brain)=>({brain,text:'{"lines":[]}'});
  episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;
  // Reproduce the persisted state of the pre-fix failed generation, then use Resume.
  episode.production.flow.maxTurns=12;episode.production.turnLimit=12;episode.production.status='paused';episode.production.reason='Old introduction/line-budget failure.';
  await writeFile(path.join(root,'.sovereign/studio/v1',profile,'episodes',episode.id+'.json'),JSON.stringify(episode));restart();
  episode=(await control(episode,'resume')).episode;
  episode=(await control(episode,'turn')).episode;
  const expected=18+episode.plan.cast.length;
  assert.equal(episode.production.writer.lines.length,expected);assert.equal(episode.production.schedule.length,expected);
  assert.deepEqual(episode.production.writer.lines.slice(episode.plan.cast.length),originalBody);
  for(let index=0;index<expected;index++){
    if(index)episode=(await control(episode,'turn')).episode;
    episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;
  }
  assert.equal(episode.production.phase,'voicing');assert.equal(episode.production.cursor,expected);assert.equal(writes,1);
  restart();const loaded=(await call('episodes/'+episode.id)).episode;
  assert.equal(loaded.production.writer.lines.at(-1).intent,'closing');assert.equal(activeTurns(loaded.production).length,expected);
}));

test('a completed scene survives a pause during director staging and resumes without paying the writer again',()=>fixture(async({boot,control,call,tokens,ai})=>{
  let {episode}=await boot();let writes=0,stageStarted=false,release;
  ai.writeStudio=async(_profile,brain,input)=>{writes++;const ids=input.cast.map(member=>member.characterId),other=ids.filter(id=>id!==input.firstSpeakerId),order=[input.firstSpeakerId,other[0],other[1],other[0],other[1],input.firstSpeakerId];return {brain,text:JSON.stringify({summary:'A saved coherent scene.',lines:order.map((characterId,index)=>({characterId,text:['नमस्कार, आज गली के बिस्कुट की खबर है।','दुकानदार ने कुत्ते के लिए अलग खाता खोल दिया।','खाते में जमा बिस्कुट पड़ोसी खा गया।','अब हर ग्राहक अपनी रसीद लेकर खड़ा है।','रसीद पर दुकान की जगह पेड़ का पता लिखा है।','आखिर पूरी दुकान ही पेड़ के नीचे खुल गई।'][index],intent:index===0?'setup':index===5?'closing':index===4?'payoff':'statement',targetId:null,introducedCharacterIds:index===0?other:[],cues:[]}))})};};
  ai.stageStudio=async(_profile,brain)=>{stageStarted=true;return new Promise(resolve=>release=()=>resolve({brain,text:JSON.stringify({lines:[]})}));};
  let requestId;for(let i=0;i<100;i++){const candidate=randomUUID();if(!planBanter({runId:candidate,cast:episode.plan.cast,turnCount:12,format:'deadpan-meme',mode:'improvised'})){requestId=candidate;break;}}
  episode=(await control(episode,'start',{requestId,adaptive:true,prepareOnly:true})).episode;const pending=call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'turn'});
  while(!stageStarted)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal((await call(`episodes/${episode.id}/production`)).phase,'staging');episode=(await call(`episodes/${episode.id}`)).episode;assert.ok(episode.production.writer);assert.equal(episode.production.turns.length,0);
  episode=(await control(episode,'pause')).episode;release();assert.equal((await pending).status,409);assert.equal(writes,1);
  ai.stageStudio=async(_profile,brain)=>({brain,text:JSON.stringify({lines:[{lineIndex:0,shot:'close-up',reactionCharacterId:null,reactionActionId:null,atFraction:.5,intensity:0}]})});episode=(await control(episode,'resume')).episode;episode=(await control(episode,'turn')).episode;
  assert.equal(writes,1);assert.equal(episode.production.turns.length,1);assert.equal(episode.production.writer.lines.length,6);assert.equal(episode.production.writer.staging.lines[0].shot,'close-up');
}));


test('director reactions are sparse, separated and favour an earned payoff',()=>{
 const lines=Array.from({length:12},(_,index)=>({intent:index===11?'payoff':index%3===2?'answer':'statement'})),plan={lines:lines.map((_line,index)=>({lineIndex:index,shot:'reaction',reactionCharacterId:'listener',reactionActionId:'response.raise-eyebrow',atFraction:.7,intensity:.5}))};
 const staged=sparseStaging(plan,lines),active=staged.lines.filter(line=>line.reactionActionId);assert.ok(active.length<=4);assert.ok(active.some(line=>line.lineIndex===11));for(let i=1;i<active.length;i++)assert.ok(active[i].lineIndex-active[i-1].lineIndex>1);assert.ok(staged.lines.some(line=>line.shot==='auto'&&line.reactionCharacterId===null));
});

test('background turn requests return immediately, survive disconnect and expose only owned progress',()=>fixture(async({boot,control,call,tokens,hold,calls})=>{
  let {episode}=await boot();episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;let release;
  hold(async(_profile,actor,input)=>new Promise(resolve=>release=()=>resolve({brain:actor.brain,text:JSON.stringify({text:'नमस्कार, इस मोहल्ले में कुत्ता आज चप्पल लेकर भाग गया।',respondsTo:null,onTopic:true,cues:[],introducedCharacterIds:input.opening.panel.map(member=>member.id)})})));
  const input={...tokens(episode),operation:'turn',detached:true};const started=await call(`episodes/${episode.id}/production`,'POST',input);assert.equal(started.status,202);assert.equal(started.pending,true);
  while(!release)await new Promise(resolve=>setTimeout(resolve,10));const pending=await call(`episodes/${episode.id}/production?requestId=${input.requestId}`);assert.equal(pending.pending,true);assert.ok(!pending.episode);
  const retry=await call(`episodes/${episode.id}/production`,'POST',input);assert.equal(retry.status,202);assert.equal(calls.length,1);
  release();let result;for(let i=0;i<100;i++){result=await call(`episodes/${episode.id}/production?requestId=${input.requestId}`);if(!result.pending)break;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(result.status,200);assert.equal(result.episode.production.turns.length,1);assert.equal(calls.length,1);
  const conflicting=await call(`episodes/${episode.id}/production`,'POST',{...input,expectedRevision:999});assert.equal(conflicting.status,409);
}));

test('delivery leaves quick answers and longer payoff space without changing legacy takes',()=>{
 assert.equal(deliveryPause({text:'Really?'}),260);assert.equal(deliveryPause({text:'A reply.'}),380);assert.equal(deliveryPause({segment:'payoff'}),1900);assert.equal(deliveryPause({segment:'payoff'},{enabled:false}),0);
});
test('listener laughter uses actual facial shapes while speech retains ownership of the jaw',()=>{
 const actions=[{actionId:'comedy.laugh',intensity:.8,progress:.5}],listener=facialReactionSample(actions),speaker=facialReactionSample(actions,{speaking:true});
 assert.ok(listener.AK_25_JawOpen>0);assert.ok(listener.AK_44_MouthSmileLeft>.5);assert.ok(listener.AK_09_EyeBlinkLeft>0);assert.equal(speaker.AK_25_JawOpen,undefined);assert.deepEqual(facialReactionSample([]),{});
});
test('writer question metadata repair follows an explicit next answer without rewriting dialogue',()=>{
 const cast=[{characterId:'a'},{characterId:'b'},{characterId:'c'}],scene={lines:[{characterId:'a',intent:'question',targetId:'a',text:'Why?'},{characterId:'b',intent:'answer',text:'Because.'}]};
 const fixed=normaliseWriterScene(scene,{cast});assert.equal(fixed.lines[0].targetId,'b');assert.equal(scene.lines[0].targetId,'a');assert.equal(fixed.lines[0].text,'Why?');scene.lines[0].targetId='c';assert.equal(normaliseWriterScene(scene,{cast}).lines[0].targetId,'c');
});

test('failed background generation remains a JSON job result with a recoverable saved show',()=>fixture(async({boot,control,call,tokens,hold})=>{
 let {episode}=await boot();episode=(await control(episode,'start',{adaptive:true})).episode;
 hold(async()=>{throw Object.assign(new Error('Provider temporarily unavailable.'),{status:502});});
 const input={...tokens(episode),operation:'turn',detached:true};assert.equal((await call(`episodes/${episode.id}/production`,'POST',input)).status,202);
 let result;for(let n=0;n<100;n++){result=await call(`episodes/${episode.id}/production?requestId=${input.requestId}`);if(!result.pending)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(result.status,200);assert.ok(result.error);assert.ok(result.error.message);const saved=await call(`episodes/${episode.id}`);assert.equal(saved.episode.production.turns.length,0);assert.equal(saved.episode.production.status,'paused');
}));

test('timed close-ups and disgust validate only against actual actors and saved lines',()=>{
 const value={summary:'Close-up during the reply.',commands:[{kind:'shot',shot:'close-up',characterId:'a',actionId:null,timing:{lineId:'line',atFraction:.7}},{kind:'reaction',shot:null,characterId:'a',actionId:'expression.disgust',timing:{lineId:'line',atFraction:.7}}]};
 assert.equal(validateDirection(value,{characterIds:['a'],lineIds:['line']}),value);assert.throws(()=>validateDirection(value,{characterIds:['a'],lineIds:['other']}));assert.ok(directorCapabilities().shots.includes('close-up'));
 const face=facialReactionSample([{actionId:'expression.disgust',intensity:.8,progress:.5}],{speaking:true});assert.ok(face.AK_09_EyeBlinkLeft>.2);assert.equal(face.AK_25_JawOpen,undefined);
});
test('camera directions persist with the saved line and cannot target another version',()=>fixture(async({boot,control,call,tokens,restart})=>{
 let {episode}=await boot();episode=(await control(episode,'start',{prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;const turn=episode.production.turns[0];
 const target=episode.plan.cast.find(member=>member.slotId==='rotating').characterId;const input={...tokens(episode),operation:'camera-cue',turnId:turn.id,characterId:target,shot:'close-up',atFraction:.6};episode=(await call(`episodes/${episode.id}/production`,'POST',input)).episode;
 restart();assert.equal((await call(`episodes/${episode.id}`)).episode.production.cameraCues.length,1);assert.equal((await call(`episodes/${episode.id}/production`,'POST',input)).replayed,true);
 const bad=await call(`episodes/${episode.id}/production`,'POST',{...tokens(episode),operation:'camera-cue',turnId:randomUUID(),shot:'close-up',atFraction:.6});assert.equal(bad.status,400);const revised=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'revise',plan:{...Object.fromEntries(['premise','formatId','writingMode','language','viewerMode','humanParticipant','media','beats','cues'].map(key=>[key,episode.plan[key]])),cast:episode.plan.cast.filter(member=>member.characterId!==target)}});assert.equal(revised.status,200,JSON.stringify(revised));
}));

test('listener attention is staggered, selective, continuous and repeatable through pauses and seeking',()=>{
 const actors=['a','b','c','d'],turns=Array.from({length:12},(_,i)=>({id:'line-'+i,characterId:actors[i%4],startMs:i*5000}));const samples=actors.map(characterId=>attentionSample({characterId,turns,timeMs:900,hostId:'a'}));assert.ok(new Set(samples.map(s=>s.changedAtMs)).size>1);assert.ok(samples.some(s=>s.targetId==='neutral'));
 for(const characterId of actors){const input={characterId,turns,timeMs:21000,hostId:'a'};assert.deepEqual(attentionSample(input),attentionSample(input));const pause=attentionSample({...input,timeMs:24999});assert.ok(Object.values(pause.weights).every(w=>w>=0&&w<=1));assert.ok(Math.abs(Object.values(pause.weights).reduce((a,b)=>a+b,0)-1)<.00001);
 for(let time=0;time<55000;time+=137){const before=attentionSample({...input,timeMs:time}),after=attentionSample({...input,timeMs:time+.1}),ids=new Set([...Object.keys(before.weights),...Object.keys(after.weights)]);assert.ok([...ids].reduce((sum,id)=>sum+Math.abs((before.weights[id]||0)-(after.weights[id]||0)),0)<.01);}}
 const question={characterId:'b',turns,timeMs:600,script:[{targetId:'b'}],atTurn:0};assert.equal(attentionSample(question).targetId,'a');
});

test('new scenes require an earned payoff and a separate host closing',()=>{
 const cast=[{characterId:'host'},{characterId:'panel'}],line=(characterId,intent)=>({characterId,intent,text:'A distinct short line.',targetId:null,introducedCharacterIds:intent==='setup'?['panel']:[],cues:[]}),scene={summary:'A complete scene.',lines:[line('host','setup'),line('panel','statement'),line('panel','payoff'),line('host','closing')]};const options={cast,firstSpeakerId:'host',hostId:'host',requireClosing:true,minLines:4,maxLines:12};assert.equal(validateWriterScene(scene,options),scene);assert.throws(()=>validateWriterScene({...scene,lines:scene.lines.map((l,i)=>i===3?{...l,characterId:'panel'}:l)},options));assert.throws(()=>validateWriterScene({...scene,lines:scene.lines.map((l,i)=>i===2?{...l,intent:'statement'}:l)},options));assert.equal(deliveryPause({intent:'closing',segment:'payoff'}),5200);assert.equal(deliveryPause({intent:'payoff',segment:'panel'}),1900);
});

test('every generated show starts with the exact spoken brand once, without restarting continuations',()=>{
 const first='नमस्कार, हमारे मेहमान आज साथ हैं।',scene={lines:[{characterId:'host',intent:'setup',text:first,targetId:null},{characterId:'other',intent:'statement',text:'अगली बात।',targetId:null}]},cast=[{characterId:'host'},{characterId:'other'}];const normal=normaliseWriterScene(scene,{cast,initial:true});assert.equal(normal.lines[0].text,SHOW_OPENING+' '+first);assert.equal(scene.lines[0].text,first);assert.deepEqual(normaliseWriterScene(normal,{cast,initial:true}),normal);assert.equal(normaliseWriterScene(scene,{cast,initial:false}).lines[0].text,first);assert.equal(showOpening('बात का बवाल। मुद्दा छोटा। बवाल बड़ा। '+first),SHOW_OPENING+' '+first);assert.equal(showOpening('स्वागत है आपका ‘बात का बवाल’ में। यहाँ पानी साफ है, बहस नहीं।'),SHOW_OPENING+' यहाँ पानी साफ है, बहस नहीं।');
});

test('screen headlines save independently without invalidating prepared dialogue, voices or epoch',()=>fixture(async({boot,control,call,tokens})=>{
 let {episode}=await boot();episode=(await control(episode,'start',{turnLimit:2})).episode;episode=(await control(episode,'turn')).episode;episode=(await control(episode,'voice',{turnId:episode.production.awaitingPlayback})).episode;const production=structuredClone(episode.production),epoch=episode.epoch;let result=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'headline',headline:'गोलगप्पे में साफ पानी पर बवाल!'});assert.equal(result.status,200,JSON.stringify(result));episode=result.episode;assert.equal(episode.headline,'गोलगप्पे में साफ पानी पर बवाल!');assert.equal(episode.epoch,epoch);assert.deepEqual(episode.production,production);result=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'headline',headline:'x'.repeat(101)});assert.equal(result.status,400);result=await call(`episodes/${episode.id}`,'PATCH',{...tokens(episode),operation:'headline',headline:null});assert.equal(result.status,200);assert.equal(result.episode.headline,null);
}));
test('continuation writer chooses a natural speaker and keeps the correct actor snapshot',()=>fixture(async({boot,control,ai})=>{
 let {episode}=await boot();let chosen;
 ai.writeStudio=async(_p,brain,input)=>{
  const ids=input.cast.map(m=>m.characterId),initial=!!input.opening,host=input.hostId;
  chosen=initial?host:ids.find(id=>id!==episode.production.schedule[episode.production.cursor].speakerId);
  assert.equal(input.firstSpeakerId,initial?host:null);if(!initial){assert.equal(input.history.length,activeTurns(episode.production).length);assert.ok(input.history.every(line=>line.intent!=='closing'));assert.ok(input.minLines>=4);assert.equal(input.maxLines,input.dialogueMaxLines);}
  const order=initial?[host,...ids.filter(id=>id!==host),host]:[chosen,ids.find(id=>id!==chosen),chosen,ids.find(id=>id!==chosen),chosen,host];
  return {brain,text:JSON.stringify({summary:'A coherent clock conversation.',detourUsed:false,lines:order.map((characterId,i)=>({characterId,text:(initial?'Original clock discussion ':'Continuing clock discussion '+input.history.length+' ')+i,intent:i===order.length-1?'closing':i===order.length-2?'payoff':initial&&i===0?'setup':'statement',targetId:null,introducedCharacterIds:initial&&i===0?ids.filter(id=>id!==host):[],cues:[]}))})};
 };
 episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;
 while(episode.production.phase==='composing'){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
 episode=(await control(episode,'ready',{captions:true})).episode;
 const first=activeTurns(episode.production)[0];episode=(await control(episode,'edit-line',{beatId:first.beatId,characterId:first.characterId,text:'An edited original opening.',locked:true})).episode;episode=(await control(episode,'ready',{captions:true})).episode;
 const before=structuredClone(episode.production.turns);
 episode=(await control(episode,'continue')).episode;
 episode=(await control(episode,'turn')).episode;
 const last=episode.production.turns.at(-1);assert.equal(last.characterId,chosen);assert.equal(last.characterSnapshot.id,chosen);assert.equal(episode.production.schedule[episode.production.cursor-1].speakerId,chosen);assert.deepEqual(episode.production.turns.slice(0,before.length).map(({startMs,...line})=>line),before.map(({startMs,...line})=>line));
 episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;while(episode.production.phase==='composing'){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}assert.equal(activeTurns(episode.production).at(-1).intent,'closing');assert.equal(activeTurns(episode.production).filter(line=>line.intent==='closing').length,1);assert.ok(episode.production.turns.some(line=>line.id===before.find(line=>line.intent==='closing').id));assert.ok(!activeTurns(episode.production).some(line=>line.id===before.find(line=>line.intent==='closing').id));assert.ok(!episode.plan.beats.some(beat=>beat.id===before.find(line=>line.intent==='closing').beatId));
 for(let pass=0;pass<2;pass++){episode=(await control(episode,'ready',{captions:true})).episode;episode=(await control(episode,'continue')).episode;while(episode.production.phase==='composing'){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}assert.equal(activeTurns(episode.production).filter(line=>line.intent==='closing').length,1);assert.equal(activeTurns(episode.production).at(-1).intent,'closing');}
}));
test('writer still enforces a pending answer while allowing an unreserved continuation',()=>{
 const cast=[{characterId:'a'},{characterId:'b'}],scene={summary:'An answer and payoff.',lines:['b','a','a'].map((characterId,i)=>({characterId,text:'Distinct dialogue '+i,intent:i===2?'closing':i===1?'payoff':'answer',targetId:null,introducedCharacterIds:[],cues:[]}))},options={cast,initial:false,hostId:'a',minLines:3,maxLines:6,requireClosing:true};
 assert.doesNotThrow(()=>validateWriterScene(scene,{...options,firstSpeakerId:null}));assert.throws(()=>validateWriterScene(scene,{...options,firstSpeakerId:'a'}),/characterId a/);assert.doesNotThrow(()=>validateWriterScene(scene,{...options,firstSpeakerId:'b'}));
});
import {repeatsDialogue} from '../server/studio-writer.mjs';
test('writer rejects recycled speeches with cosmetic changes but permits a fresh callback',()=>{
 const earlier='The vendor locked the clean water in a cupboard and appointed a security guard to protect every single glass.';
 assert.equal(repeatsDialogue(earlier,earlier),true);assert.equal(repeatsDialogue(earlier.replace('glass.','bottle!'),earlier),true);assert.equal(repeatsDialogue('Now the security guard has resigned because the customers insist on frisking his water bottle.',earlier),false);
 const cast=[{characterId:'a'},{characterId:'b'}],scene={summary:'A premature ending.',lines:['setup','closing','payoff','closing'].map((intent,i)=>({characterId:i===2?'b':'a',text:'Different line '+i,intent,targetId:null,introducedCharacterIds:i===0?['b']:[],cues:[]}))};assert.throws(()=>validateWriterScene(scene,{cast,firstSpeakerId:'a',hostId:'a',maxLines:12,requireClosing:true}),/single host closing/);
});
test('18+ setting persists per channel and reaches new writing without rewriting a prepared show',()=>fixture(async({boot,call,tokens,control,ai,restart})=>{
 let {episode}=await boot();const channelId=episode.plan.channelId;let channel=(await call('channels/'+channelId)).channel;
 let result=await call('channels/'+channelId,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,adultComedy:'yes'}});assert.equal(result.status,400);
 channel=(await call('channels/'+channelId,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,adultComedy:true}})).channel;restart();assert.equal((await call('channels/'+channelId)).channel.definition.adultComedy,true);
 ai.writeStudio=async(_p,brain,input)=>{assert.equal(input.adultComedy,true);const ids=input.cast.map(m=>m.characterId),host=input.hostId,other=ids.filter(id=>id!==host),order=[host,...other,host];return {brain,text:JSON.stringify({summary:'A character-led discussion.',detourUsed:false,lines:order.map((characterId,i)=>({characterId,text:'A distinctive discussion line '+i,intent:i===order.length-1?'closing':i===order.length-2?'payoff':i===0?'setup':'statement',targetId:null,introducedCharacterIds:i===0?other:[],cues:[]}))})};};
 episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;while(episode.production.phase==='composing'){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}const saved=structuredClone(episode.production);
 channel=(await call('channels/'+channelId,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,adultComedy:false}})).channel;assert.equal(channel.definition.adultComedy,false);assert.deepEqual((await call('episodes/'+episode.id)).episode.production,saved);
}));
test('scene editor rejects repetitive side banter and the writer retries before any dialogue is committed',()=>fixture(async({boot,control,ai})=>{
 let {episode}=await boot(),writes=0,reviews=0;
 ai.writeStudio=async(_p,brain,input)=>{writes++;if(writes===2)assert.match(input.recovery,/return to the vendor/);const host=input.hostId,others=input.cast.map(m=>m.characterId).filter(id=>id!==host),order=[host,...others,host];return {brain,text:JSON.stringify({summary:'The vendor changes the price.',detourUsed:false,lines:order.map((characterId,i)=>({characterId,text:(writes===1?'Unrelated flirting ':'The vendor price changes ')+i,intent:i===order.length-1?'closing':i===order.length-2?'payoff':i===0?'setup':'statement',targetId:null,introducedCharacterIds:i===0?others:[],cues:[]}))})};};
 ai.reviewStudio=async(_p,brain,input)=>{reviews++;assert.ok(input.characters.every(person=>person.personality));return {brain,text:JSON.stringify(editorReview({balanced:reviews>1,fresh:reviews>1,coherent:true,responsive:true,earnedEnding:true,inCharacter:true,reason:reviews===1?'Stop repeating the personal banter; return to the vendor and develop a new consequence.':'The new price develops the premise.'}))};};
 episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;assert.equal(writes,2);assert.equal(reviews,2);assert.equal(activeTurns(episode.production).length,1);assert.match(activeTurns(episode.production)[0].text,/vendor price/);assert.ok(!JSON.stringify(episode.production.writer).includes('Unrelated flirting'));
}));

test('independent review survives a service failure and Resume without rewriting the saved draft',()=>fixture(async({boot,control,call,tokens,ai,count,restart,errors})=>{
 let {episode,channel}=await boot(),writes=0,reviews=0,available=false;
 channel=(await call('channels/'+channel.id,'PATCH',{...tokens(channel),operation:'revise',definition:{...channel.definition,reviewingBrain:{provider:'anthropic',model:'anthropic-fixture'}}})).channel;
 ai.writeStudio=async(_p,brain,input)=>{writes++;const ids=input.cast.map(m=>m.characterId),host=input.hostId;return {brain,text:JSON.stringify({summary:'A saved script awaiting independent review.',detourUsed:false,introductions:ids.map(characterId=>({characterId,text:'Introducing '+characterId})),lines:[ids[1],ids[2],ids[1],host].map((characterId,i)=>({characterId,text:'A unique short saved dialogue '+i,intent:i===3?'closing':i===2?'payoff':'statement',targetId:null,introducedCharacterIds:[],cues:[]}))})};};
 ai.reviewStudio=async(_p,brain)=>{reviews++;assert.equal(brain.provider,'anthropic');if(!available)throw new SessionError('Reviewer temporarily unavailable.',503,'MODEL_UNAVAILABLE');return {brain,text:JSON.stringify(editorReview({balanced:true,fresh:true,coherent:true,responsive:true,earnedEnding:true,inCharacter:true,reason:'The payoff and characters remain intact.'}))};};
 episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;const response=await call('episodes/'+episode.id+'/production','POST',{...tokens(episode),operation:'turn'});assert.equal(response.status,503,JSON.stringify(response)+errors.map(e=>e.stack).join("\\n"));episode=(await call('episodes/'+episode.id)).episode;assert.equal(episode.production.status,'paused');assert.equal(episode.production.editorial.status,'reviewing');assert.equal(episode.production.turns.length,0);assert.equal(count(),0);
 restart();available=true;episode=(await control(episode,'resume')).episode;episode=(await control(episode,'turn')).episode;assert.equal(writes,1);assert.equal(reviews,2);assert.equal(episode.production.editorial.status,'approved');assert.equal(episode.production.editorial.reviewerBrain.provider,'anthropic');assert.equal(episode.production.turns.length,1);assert.equal(count(),0);
}));

for(const failedCheck of ['coherent','responsive','earnedEnding','inCharacter'])test(`scene editor repairs ${failedCheck} while retaining the draft and character packets`,()=>fixture(async({boot,control,ai})=>{
 let {episode}=await boot(),writes=0,reviews=0,packets;
 ai.writeStudio=async(_p,brain,input)=>{writes++;if(writes===2){assert.match(input.recovery,/line 2/);assert.ok(input.revisionDraft.lines.length>=4);assert.deepEqual(input.characters,packets);}packets=structuredClone(input.characters);const host=input.hostId,others=input.cast.map(m=>m.characterId).filter(id=>id!==host),order=[host,...others,host];return {brain,text:JSON.stringify({summary:'The price change has a consequence.',detourUsed:false,lines:order.map((characterId,i)=>({characterId,text:`${writes===1?'Unclear':'Repaired'} distinctive price consequence ${i}`,intent:i===order.length-1?'closing':i===order.length-2?'payoff':i===0?'setup':'statement',targetId:null,introducedCharacterIds:i===0?others:[],cues:[]}))})};};
 ai.reviewStudio=async(_p,brain)=>{reviews++;return {brain,text:JSON.stringify(editorReview({balanced:true,fresh:true,coherent:true,responsive:true,earnedEnding:true,inCharacter:true,[failedCheck]:reviews>1,reason:reviews===1?'Repair line 2 with the actual answer and preserve all character facts.':'The repair connects.'}))};};
 episode=(await control(episode,'start',{adaptive:true,prepareOnly:true})).episode;episode=(await control(episode,'turn')).episode;assert.equal(writes,2);assert.equal(reviews,2);assert.match(activeTurns(episode.production)[0].text,/Repaired/);assert.ok(!JSON.stringify(episode.production.writer).includes('Unclear'));
}));

test('creator approval pins a saved edit; deleting versions or episodes removes all future story influence and survives restart',()=>fixture(async({boot,control,call,tokens,restart,ai})=>{
 let {episode,channel}=await boot();episode=(await control(episode,'start',{turnLimit:3,prepareOnly:true})).episode;
 for(let i=0;i<3;i++){episode=(await control(episode,'turn')).episode;episode=(await control(episode,'drafted',{turnId:episode.production.awaitingPlayback})).episode;}
 for(const line of activeTurns(episode.production))episode=(await control(episode,'voice',{turnId:line.id})).episode;
 episode=(await control(episode,'ready')).episode;
 const patch=async(operation,extra={})=>{const result=await call('episodes/'+episode.id,'PATCH',{...tokens(episode),operation,...extra});assert.equal(result.status,200,JSON.stringify(result));episode=result.episode;return result;};
 await patch('accept-take',{takeId:randomUUID()});const original=episode.takes[0],route='episodes/'+episode.id;
 assert.equal((await call('episodes')).episodes[0].storyApproval,null);
 assert.equal((await call(route,'PATCH',{...tokens(episode),operation:'approve-story',takeId:randomUUID()})).status,409);
 const approval={...tokens(episode),operation:'approve-story',takeId:original.id};let response=await call(route,'PATCH',approval);assert.equal(response.status,200);episode=response.episode;assert.equal((await call(route,'PATCH',approval)).replayed,true);
 const edited={...original.edition,order:original.edition.order.slice(1).reverse()};await patch('accept-take',{takeId:randomUUID(),sourceTakeId:original.id,edition:edited});const second=episode.takes.at(-1);assert.equal(episode.storyApproval.takeId,original.id);
 const removal={...tokens(episode),operation:'delete-take',takeId:original.id};response=await call(route,'PATCH',removal);assert.equal(response.status,200);episode=response.episode;assert.equal(episode.storyApproval,null);assert.equal((await call(route,'PATCH',removal)).replayed,true);restart();
 assert.equal((await call('episodes')).episodes[0].takeCount,1);assert.equal((await call(route)).episode.takes.find(take=>take.id===second.id).sourceTakeId,original.id);
 assert.equal((await call('exports','POST',{id:randomUUID(),episodeId:episode.id,takeId:original.id,format:'horizontal'})).status,404);
 assert.equal((await call(route,'PATCH',{...tokens(episode),operation:'accept-take',takeId:randomUUID(),sourceTakeId:original.id})).status,400);
 await patch('approve-story',{takeId:second.id});const stale=tokens(episode);
 await patch('unapprove-story');assert.equal((await call(route,'PATCH',{...stale,operation:'approve-story',takeId:second.id})).status,409);await patch('approve-story',{takeId:second.id});
 const lib=(await call('characters')).library,actor=lib.characters[0],fact={id:'from-approved-edit',text:'A fact from the approved edit.',origin:'episode',visibility:'public',sourceEpisodeId:episode.id,sourceTakeId:second.id};
 const memory=await call('characters','POST',{requestId:randomUUID(),id:actor.id,expectedRevision:lib.revision,action:'update',approvedCanon:true,character:Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(key=>[key,actor[key]])),profile:{...actor.studioProfile,canon:[{id:'creator',text:'Loves chai.',origin:'creator',visibility:'public'},fact,{...fact,id:'deleted-version',sourceTakeId:original.id}]}});assert.equal(memory.status,200,JSON.stringify(memory));
 const characterContext=()=>call('character-context?channelId='+channel.id+'&observerId='+actor.id+'&subjectId='+actor.id);
 assert.deepEqual((await characterContext()).canon.map(f=>f.id),['creator','from-approved-edit']);
 const fresh=(await call('episodes','POST',{id:randomUUID(),requestId:randomUUID(),channelId:channel.id,plan:{premise:'A new fictional show.',cast:episode.plan.cast}})).episode;
 const captured=[];ai.writeStudio=async(_profile,_brain,input)=>{captured.push(input);throw new SessionError('Capture only.',503);};
 let current=(await control(fresh,'start',{prepareOnly:true,adaptive:true,mode:'improvised'})).episode;assert.equal((await call('episodes/'+current.id+'/production','POST',{...tokens(current),operation:'turn'})).status,503);
 assert.equal(captured.length,1);assert.deepEqual(captured[0].recentScenes.map(item=>item.takeId),[second.id]);assert.equal(captured[0].recentScenes[0].ending,activeTurns(second.productionSnapshot).find(line=>line.id===edited.order.at(-1)).text);
 const deletion={...tokens(episode),operation:'delete'};response=await call(route,'PATCH',deletion);assert.equal(response.status,200);assert.equal(response.episode.storyApproval,null);assert.equal((await call(route,'PATCH',deletion)).replayed,true);restart();
 assert.equal((await call(route)).status,404);assert.equal((await call('episodes')).episodes.some(item=>item.id===episode.id),false);assert.equal((await call(route+'/production','POST',{...tokens(response.episode),operation:'resume'})).status,404);
 assert.deepEqual((await characterContext()).canon.map(f=>f.id),['creator']);
 const paused=(await call('episodes/'+fresh.id)).episode;current=(await control(paused,'resume')).episode;captured.length=0;assert.equal((await call('episodes/'+fresh.id+'/production','POST',{...tokens(current),operation:'turn'})).status,503);assert.deepEqual(captured[0].recentScenes,[]);
}));
