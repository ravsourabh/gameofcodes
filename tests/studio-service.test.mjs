import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,writeFile,lstat,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSessionService} from '../server/sessions.mjs';
import {createCharacterLibrary} from '../server/character-library.mjs';
import {createStudioStore} from '../server/studio-store.mjs';
import {validateStudioRecord} from '../shared/studio/records.mjs';
import {episodeInput} from '../shared/studio/episodes.mjs';
import {seedDiscussion,discussionFixtureAI} from './fixtures/discussion.mjs';
import {metaHumanRigFixture} from './fixtures/metahuman-rig.mjs';
import {installMetaHuman} from '../scripts/install-metahuman.mjs';

async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'goc-studio-test-')),seed=await seedDiscussion(root),ai=discussionFixtureAI().ai;
  const profileId=seed.profile,actors=seed.session.characters.map(actor=>actor.id),errors=[];
  let service=createSessionService({root,ai,onError:error=>errors.push(error)});
  const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,method='GET',input,headers={})=>{const res=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:res.status,data:await res.json()};};
  const route=(part,profile=profileId)=>'/api/studio/'+part+'?profileId='+profile;
  const createChannel=async(templateId='meme-radio')=>{const result=await call(route('channels'),'POST',{id:randomUUID(),requestId:randomUUID(),templateId});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.channel;};
  const cast=[{slotId:'host',characterId:actors[0]},{slotId:'regular',characterId:actors[1]}];
  const createEpisode=async(channel,plan={})=>{const result=await call(route('episodes'),'POST',{id:randomUUID(),requestId:randomUUID(),channelId:channel.id,plan:{premise:'A committee meets to cancel unnecessary meetings.',cast,...plan}});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.episode;};
  const change=(record,operation,extra={})=>({requestId:randomUUID(),expectedRevision:record.revision,expectedEpoch:record.epoch,operation,...extra});
  try{await run({root,profileId,seed,actors,cast,call,route,origin,errors,createChannel,createEpisode,change,restart:()=>{service=createSessionService({root,ai,onError:error=>errors.push(error)});}});}
  finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-studio-test-'));await rm(root,{recursive:true,force:true});}
}

test('studio HTTP persists two independent channels and episodes across restart, with pinned settings',()=>fixture(async({call,route,createChannel,createEpisode,change,restart})=>{
  let first=await createChannel(),second=await createChannel('reality-room');
  const a=await createEpisode(first),b=await createEpisode(second,{premise:'Contestants explain their strangest hobby.'});
  first=(await call(route('channels/'+first.id),'PATCH',change(first,'revise',{definition:{...first.definition,name:'Edited station',language:{primary:'en-IN',codeSwitching:false}}}))).data.channel;
  restart();
  assert.deepEqual((await call(route('channels/'+first.id))).data.channel,first);
  assert.deepEqual((await call(route('episodes/'+a.id))).data.episode,a);
  assert.deepEqual((await call(route('episodes/'+b.id))).data.episode,b);
  assert.equal(a.plan.language.primary,'hi-IN');assert.equal(b.plan.language.primary,'en-IN');
  assert.deepEqual((await call(route('episodes')+'&channelId='+first.id)).data.episodes.map(item=>item.id),[a.id]);
  assert.equal((await call(route('channels'))).data.channels.length,2);
}));

test('MetaHuman room choices are owned, reversible and pinned in takes without changing characters',()=>fixture(async({root,call,route,createChannel,createEpisode,actors,change,restart})=>{
  let channel=await createChannel();const people=(await call(route('characters'))).data.library.characters,episode=await createEpisode(channel),setting={metaHuman:true,assignments:[{characterId:actors[0],modelId:'test-rig'}]};
  assert.equal((await call('/api/studio/avatar-renderers')).data.available,false);const denied=await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,avatarRendering:setting}}));assert.equal(denied.status,400);assert.equal((await call(route('channels/'+channel.id))).data.channel.revision,channel.revision);
  const input=path.join(root,'fixture.glb'),license=path.join(root,'NOTICE.txt');await writeFile(input,await metaHumanRigFixture());await writeFile(license,'MIT synthetic adapter test, not an Epic MetaHuman.');await installMetaHuman({root,input,license,id:'test-rig',name:'Synthetic rig fixture',sourceUrl:'https://www.fab.com/listings/27a81942-69bf-498e-a41f-004d0d2db37b'});
  const save=change(channel,'revise',{definition:{...channel.definition,avatarRendering:setting}});channel=(await call(route('channels/'+channel.id),'PATCH',save)).data.channel;assert.deepEqual(channel.definition.avatarRendering,setting);restart();assert.equal((await call(route('channels/'+channel.id),'PATCH',save)).data.replayed,true);
  const accepted=(await call(route('episodes/'+episode.id),'PATCH',change(episode,'accept-take',{takeId:randomUUID()}))).data.episode;assert.deepEqual(accepted.takes[0].avatarRendering,setting);
  channel=(await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,avatarRendering:{...setting,metaHuman:false}}}))).data.channel;assert.equal(channel.definition.avatarRendering.metaHuman,false);assert.deepEqual((await call(route('characters'))).data.library.characters,people);assert.deepEqual((await call(route('episodes/'+episode.id))).data.episode.takes[0],accepted.takes[0]);
  const unknown=await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,avatarRendering:{metaHuman:true,assignments:[{characterId:randomUUID(),modelId:'test-rig'}]}}}));assert.equal(unknown.status,400);assert.equal(unknown.data.code,'UNKNOWN_CHARACTER');
}));

test('channel cast defaults resolve owned identities without adding a mandatory guide',()=>fixture(async({call,route,createChannel,actors,change})=>{
  let channel=await createChannel();assert.equal(channel.definition.defaultCast,undefined);
  const defaults=[{slotId:'host',characterId:actors[0]},{slotId:'regular',characterId:actors[1]}];
  channel=(await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,defaultCast:defaults}}))).data.channel;
  const result=await call(route('episodes'),'POST',{id:randomUUID(),requestId:randomUUID(),channelId:channel.id,plan:{premise:'A scripted committee.'}});
  assert.equal(result.status,201);assert.deepEqual(result.data.episode.plan.cast,defaults.map(member=>({schemaVersion:1,...member})));
  const bad=await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,defaultCast:[{slotId:'host',characterId:randomUUID()}]}}));
  assert.equal(bad.status,400);assert.equal(bad.data.code,'UNKNOWN_CHARACTER');
}));

test('durable receipts replay exactly once after restart; competing revisions and stale epochs conflict',()=>fixture(async({call,route,createChannel,createEpisode,change,restart})=>{
  const input={id:randomUUID(),requestId:randomUUID(),templateId:'meme-radio'};
  const duplicates=await Promise.all([call(route('channels'),'POST',input),call(route('channels'),'POST',input)]);
  assert.deepEqual(duplicates.map(result=>result.status).sort(),[200,201]);
  restart();assert.equal((await call(route('channels'),'POST',input)).data.replayed,true);
  assert.equal((await call(route('channels'),'POST',{...input,templateId:'reality-room'})).status,409);
  const episode=await createEpisode(await createChannel());
  const edits=await Promise.all(['A','B'].map(premise=>call(route('episodes/'+episode.id),'PATCH',change(episode,'revise',{plan:{...episodeInput(episode.plan),id:undefined,premise}}))));
  assert.deepEqual(edits.map(result=>result.status).sort(),[200,409]);
  const winner=edits.find(result=>result.status===200).data.episode;
  const cancellation=change(winner,'cancel'),cancelled=await call(route('episodes/'+episode.id),'PATCH',cancellation);
  assert.equal(cancelled.data.episode.epoch,2);restart();
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',cancellation)).data.replayed,true);
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',change(winner,'accept-take',{takeId:randomUUID()}))).status,409);
  const denied=await call(route('episodes/'+episode.id),'PATCH',change(cancelled.data.episode,'accept-take',{takeId:randomUUID()}));assert.equal(denied.data.code,'EPISODE_CANCELLED');
}));

test('accepted takes freeze the channel, character, voice and rundown snapshots despite later edits',()=>fixture(async({root,profileId,call,route,createChannel,createEpisode,change,restart})=>{
  const channel=await createChannel(),episode=await createEpisode(channel),takeId=randomUUID(),accept=change(episode,'accept-take',{takeId});
  let accepted=await call(route('episodes/'+episode.id),'PATCH',accept);assert.equal(accepted.status,200,JSON.stringify(accepted.data));
  const snapshot=structuredClone(accepted.data.episode.takes[0]);
  const characters=createCharacterLibrary({root});const saved=await characters.peek(profileId),actor=saved.characters.find(actor=>actor.id===episode.plan.cast[0].characterId);
  const {characterFields}=await import('../shared/character-domain.mjs');
  await characters.mutate(profileId,{requestId:randomUUID(),expectedRevision:saved.revision,action:'update',id:actor.id,character:characterFields({name:'A changed host',avatar:actor.avatar,personality:actor.personality,code:actor.code,voicePreference:actor.voicePreference})});
  await call(route('channels/'+channel.id),'PATCH',change(channel,'revise',{definition:{...channel.definition,name:'Another name'}}));
  const current=accepted.data.episode;
  accepted=await call(route('episodes/'+episode.id),'PATCH',change(current,'revise',{plan:{premise:'A different premise.',cast:current.plan.cast}}));
  assert.equal(accepted.status,200);restart();
  const loaded=(await call(route('episodes/'+episode.id))).data.episode;
  assert.deepEqual(loaded.takes[0],snapshot);assert.equal(loaded.plan.premise,'A different premise.');
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',accept)).data.replayed,true);
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',change(loaded,'accept-take',{takeId}))).status,409);
}));

test('human participation stays separate, cannot be fabricated in a plan, and blocks take acceptance until actual input',()=>fixture(async({call,route,createChannel,createEpisode,change,actors})=>{
  const channel=await createChannel('reality-room'),human={id:'human-creator',displayName:'Creator'};
  const episode=await createEpisode(channel,{formatId:'participant-show',viewerMode:'participant',humanParticipant:human,beats:[{id:'question',segment:'challenge',speakerId:actors[0]},{id:'answer',segment:'human-answer',speakerId:human.id,kind:'human-input'}]});
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',change(episode,'accept-take',{takeId:randomUUID()}))).data.code,'WAITING_FOR_HUMAN');
  const answer={beatId:'answer',participantId:human.id,text:'My real answer.',source:'human'};
  assert.equal((await call(route('episodes/'+episode.id),'PATCH',change(episode,'human-input',{...answer,source:'model'}))).status,400);
  const responded=await call(route('episodes/'+episode.id),'PATCH',change(episode,'human-input',answer));assert.equal(responded.status,200);
  const take=await call(route('episodes/'+episode.id),'PATCH',change(responded.data.episode,'accept-take',{takeId:randomUUID()}));assert.equal(take.status,200);
  assert.equal(take.data.episode.takes[0].humanInputs[0].text,answer.text);
  const invented={...episode.plan.beats[1],text:'An AI answer on my behalf.'};
  const denied=await call(route('episodes'),'POST',{id:randomUUID(),requestId:randomUUID(),channelId:channel.id,plan:{premise:'Bad human response',cast:episode.plan.cast,formatId:'participant-show',viewerMode:'participant',humanParticipant:human,beats:[invented]}});assert.equal(denied.status,400);
}));

test('invalid references, duplicated cast, unsupported modes and unknown contract fields are rejected',()=>fixture(async({call,route,createChannel,cast})=>{
  const channel=await createChannel();
  for(const extra of [{writingMode:'unbounded'},{viewerMode:'participant',humanParticipant:{id:'me',displayName:'Me'}},{formatId:'serious-news'},{cast:[cast[0],{...cast[1],characterId:cast[0].characterId}]},{cast:[cast[0],{...cast[1],characterId:randomUUID()}]},{beats:[{id:'one',segment:'setup',mediaId:'unknown'}]},{inject:'unrecognised'}]){
    const result=await call(route('episodes'),'POST',{id:randomUUID(),requestId:randomUUID(),channelId:channel.id,plan:{premise:'Invalid contract.',cast,...extra}});assert.equal(result.status,400,JSON.stringify(result));
  }
  const catalogue=(await call('/api/studio/catalog')).data;
  assert.equal(catalogue.capabilities.persistence,true);assert.equal(catalogue.capabilities.mediaPlayback,true);assert.equal(catalogue.capabilities.mediaTimeline,false);assert.equal(catalogue.capabilities.mediaPerception,false);
  assert.equal(catalogue.roomSets['reality-stage'].status,'planned');assert.ok(catalogue.roomSets['reality-stage'].anchors.participant);
}));

test('legacy session/library reads are byte-preserving and a fresh studio profile creates no folders or Virus',()=>fixture(async({root,profileId,seed,call,route})=>{
  const oldSession=path.join(root,'.sovereign','sessions','v1',profileId,seed.session.id+'.json'),oldLibrary=path.join(root,'.sovereign','characters','v1',profileId,'library.json');
  const before=await Promise.all([readFile(oldSession),readFile(oldLibrary)]);
  const result=await call(route('legacy-sessions/'+seed.session.id));assert.equal(result.status,200);assert.equal(result.data.readOnly,true);assert.equal(result.data.session.id,seed.session.id);
  assert.equal((await call(route('characters'))).data.readOnly,true);
  const fresh=randomUUID();assert.deepEqual((await call(route('channels',fresh))).data.channels,[]);assert.equal((await call(route('characters',fresh))).data.library,null);
  assert.equal((await call(route('legacy-sessions/'+seed.session.id,fresh))).status,404);
  const after=await Promise.all([readFile(oldSession),readFile(oldLibrary)]);assert.deepEqual(before,after);
  await assert.rejects(lstat(path.join(root,'.sovereign','characters','v1',fresh)),{code:'ENOENT'});
  await assert.rejects(lstat(path.join(root,'.sovereign','studio')),{code:'ENOENT'});
}));

test('profile boundaries, origin, method, content-type and body limits apply to studio routes',()=>fixture(async({call,route,origin,createChannel,change})=>{
  const channel=await createChannel(),other=randomUUID();
  assert.equal((await call(route('channels/'+channel.id,other))).status,404);
  assert.equal((await call(route('channels/'+channel.id,other),'PATCH',change(channel,'revise',{definition:channel.definition}))).status,404);
  assert.equal((await call('/api/studio/channels?profileId=../../court')).status,400);
  assert.equal((await call(route('channels'),'POST',{}, {Origin:'https://elsewhere.example'})).status,403);
  assert.equal((await call(route('channels'),'POST',{}, {'Content-Type':'text/plain'})).status,415);
  assert.equal((await call(route('channels/'+channel.id),'DELETE')).status,405);
  assert.equal((await call(route('channels'),'POST',{text:'x'.repeat(1_000_001)})).status,413);
  assert.equal((await call(route('channels'),'GET',undefined,{'sec-fetch-site':'cross-site'})).status,403);
}));

test('corrupt/future records are preserved, unavailable entries are counted, and atomic failure keeps the acknowledged file',()=>fixture(async({root,profileId,call,route,createChannel,restart})=>{
  const channel=await createChannel(),file=path.join(root,'.sovereign','studio','v1',profileId,'channels',channel.id+'.json'),before=await readFile(file,'utf8');
  const failing=createStudioStore({root,validate:validateStudioRecord,replace:async()=>{throw Object.assign(new Error('Injected replacement failure'),{code:'EIO'});}});
  await assert.rejects(failing.persist(channel,'channels'),/Injected/);assert.equal(await readFile(file,'utf8'),before);
  for(const content of ['{broken',JSON.stringify({...channel,schemaVersion:99})]){
    await writeFile(file,content);restart();assert.equal((await call(route('channels/'+channel.id))).status,409);
    assert.equal((await call(route('channels'))).data.unavailableCount,1);assert.equal(await readFile(file,'utf8'),content);
  }
}));

test('studio storage refuses directory junctions and redirected record files',()=>fixture(async({root,profileId,call,route,createChannel})=>{
  const channel=await createChannel(),folder=path.join(root,'.sovereign','studio','v1',profileId,'channels'),file=path.join(folder,channel.id+'.json'),outside=path.join(root,'preserved-target');
  await mkdir(outside);await writeFile(path.join(outside,'marker'),'preserved');
  const linkProfile=randomUUID(),link=path.join(root,'.sovereign','studio','v1',linkProfile);await symlink(outside,link,process.platform==='win32'?'junction':'dir');
  assert.equal((await call(route('channels',linkProfile))).status,409);assert.equal(await readFile(path.join(outside,'marker'),'utf8'),'preserved');
  // File symlinks require privileges on some Windows hosts; directory junction coverage is unconditional.
  if(process.platform!=='win32'){
    await rm(file);await symlink(path.join(outside,'marker'),file);assert.equal((await call(route('channels/'+channel.id))).status,409);
  }
}));
