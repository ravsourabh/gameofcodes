import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createStudioService} from '../server/studio-service.mjs';import {createCharacterLibrary} from '../server/character-library.mjs';import {replaceFile} from '../server/atomic-file.mjs';import {generateCharacter,characterFields} from '../shared/character-domain.mjs';import {starterProfile} from '../shared/studio/characters.mjs';
async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'goc-rich-characters-')),profileId=randomUUID(),characters=createCharacterLibrary({root});let failChannelWrite=false;
  const build=()=>createStudioService({root,characters,loadLegacySession:async()=>null,replace:async(from,to)=>{if(failChannelWrite&&to.includes(path.sep+'channels'+path.sep))throw Object.assign(new Error('Injected channel receipt failure'),{code:'EIO'});return replaceFile(from,to);}});let service=build();
  const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(part,method='GET',input,profile=profileId)=>{const response=await fetch(origin+'/api/studio/'+part+(part.includes('?')?'&':'?')+'profileId='+profile,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:response.status,data:await response.json()};};
  const channel=async()=>{const result=await call('channels','POST',{id:randomUUID(),requestId:randomUUID(),templateId:'meme-radio'});assert.equal(result.status,201);return result.data.channel;};
  const person=(revision=0)=>{const actor=generateCharacter(profileId);return {requestId:randomUUID(),expectedRevision:revision,action:'create',id:actor.id,character:characterFields({name:actor.name,avatar:actor.avatar,personality:actor.personality,code:actor.code,voicePreference:actor.voicePreference}),profile:{...starterProfile(actor),backstory:'A fictional retired radio producer who takes absurd rules literally.',likes:['Old radios'],dislikes:['Long committee meetings']}};};
  const tokens=record=>({requestId:randomUUID(),expectedRevision:record.revision,expectedEpoch:record.epoch});
  try{await run({root,profileId,characters,call,channel,person,tokens,restart:()=>{service=build();},failWrites:value=>{failChannelWrite=value;}});}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-rich-characters-'));await rm(root,{recursive:true,force:true});}
}
test('fresh studio character creation saves rich psychology and canon without creating a guide, and retries survive restart',()=>fixture(async({root,profileId,call,person,restart})=>{
  const input=person();const saved=await call('characters','POST',input);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.data.library.characters.length,1);assert.equal(saved.data.library.characters[0].studioProfile.likes[0],'Old radios');
  restart();const retry=await call('characters','POST',input);assert.equal(retry.data.replayed,true);assert.equal(retry.data.library.characters.length,1);assert.equal(retry.data.library.characters[0].id,input.id);assert.equal(retry.data.library.characters[0].name==='Virus',false);
  await assert.rejects(readFile(path.join(root,'.sovereign','characters','v1',profileId,'library.json')),{code:'ENOENT'});
  assert.equal((await call('characters','POST',{...input,character:{...input.character,name:'A different request'}})).status,409);
}));
test('one accept-and-join operation resumes a partial library save without a duplicate person or cast member',()=>fixture(async({call,channel,person,tokens,failWrites,restart})=>{
  const room=await channel(),input=person(),{requestId,action,...create}=input,join={...tokens(room),requestId,slotId:'host',create};
  failWrites(true);assert.equal((await call('channels/'+room.id+'/cast','POST',join)).status,500);
  assert.equal((await call('characters')).data.library.characters.length,1);assert.equal((await call('channels/'+room.id)).data.channel.definition.defaultCast,undefined);
  failWrites(false);restart();const result=await call('channels/'+room.id+'/cast','POST',join);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.channel.definition.defaultCast.length,1);assert.equal(result.data.library.characters.length,1);
  const repeated=await call('channels/'+room.id+'/cast','POST',join);assert.equal(repeated.data.replayed,true);assert.equal(repeated.data.library.characters.length,1);
}));
test('recall into two channels, removal and later recall keep the same rich identity and recent-use history',()=>fixture(async({call,channel,person,tokens,restart})=>{
  let a=await channel(),b=await channel();const input=person();let lib=(await call('characters','POST',input)).data.library;
  for(const room of [a,b]){const result=await call('channels/'+room.id+'/cast','POST',{...tokens(room),libraryRevision:lib.revision,slotId:'host',characterId:input.id});assert.equal(result.status,200,JSON.stringify(result));lib=result.data.library;if(room.id===a.id)a=result.data.channel;else b=result.data.channel;}
  const removed=await call('channels/'+a.id,'PATCH',{...tokens(a),operation:'revise',definition:{...a.definition,defaultCast:[]}});assert.equal(removed.status,200);restart();lib=(await call('characters')).data.library;
  assert.equal(lib.characters.length,1);assert.equal(lib.characters[0].studioProfile.backstory,input.profile.backstory);assert.equal(lib.usage[0].channelId,b.id);
  const joined=await call('channels/'+a.id+'/cast','POST',{...tokens(removed.data.channel),libraryRevision:lib.revision,slotId:'host',characterId:input.id});assert.equal(joined.status,200);assert.equal(joined.data.channel.definition.defaultCast[0].characterId,input.id);
}));
test('legacy enrichment preserves the original library bytes and stable identity',()=>fixture(async({root,profileId,characters,call})=>{
  const old=await characters.get(profileId),actor=old.characters[0],file=path.join(root,'.sovereign','characters','v1',profileId,'library.json'),before=await readFile(file);
  const result=await call('characters','POST',{requestId:randomUUID(),expectedRevision:old.revision,action:'update',id:actor.id,character:characterFields({name:'Raghu',avatar:actor.avatar,personality:actor.personality,code:actor.code,voicePreference:actor.voicePreference}),profile:{...starterProfile(actor,{legacy:true}),backstory:'A creator-approved original radio host.'}});
  assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.library.characters[0].id,actor.id);assert.equal(result.data.library.characters[0].name,'Raghu');assert.equal(result.data.library.characters[0].studioProvenance.origin,'legacy-enrichment');assert.deepEqual(await readFile(file),before);
}));
test('private facts never enter actor context; channel canon requires explicitly learned facts in the matching channel',()=>fixture(async({call,channel,person})=>{
  const room=await channel(),other=await channel(),first=person();first.profile.psychology.motivations=['A private internal motivation.'];first.profile.canon=[{id:'public',text:'Collects old radios.',visibility:'public',origin:'creator'},{id:'private',text:'A secret motive.',visibility:'private',origin:'creator'},{id:'local',text:'Once missed this show’s opening.',visibility:'channel',channelId:room.id,origin:'creator'}];let lib=(await call('characters','POST',first)).data.library;
  const second=person(lib.revision);lib=(await call('characters','POST',second)).data.library;
  const context=roomId=>'character-context?channelId='+roomId+'&observerId='+second.id+'&subjectId='+first.id;
  assert.deepEqual((await call(context(room.id))).data.canon.map(fact=>fact.id),['public']);
  const learn=factId=>({requestId:randomUUID(),expectedRevision:lib.revision,action:'learn',id:first.id,observerId:second.id,subjectId:first.id,channelId:room.id,factId});
  assert.equal((await call('characters','POST',learn('private'))).status,400);
  const learned=await call('characters','POST',learn('local'));assert.equal(learned.status,200);lib=learned.data.library;
  assert.deepEqual((await call(context(room.id))).data.canon.map(fact=>fact.id),['public','local']);assert.deepEqual((await call(context(other.id))).data.canon.map(fact=>fact.id),['public']);
  assert.equal(JSON.stringify((await call(context(room.id))).data).includes('secret motive'),false);
  assert.equal(JSON.stringify((await call(context(room.id))).data).includes('private internal motivation'),false);
}));
test('confirmed premise corrections are attributed, idempotent and durable before casting; older confirmation cannot replace them',()=>fixture(async({call,channel,tokens,restart})=>{
  let room=await channel();const capture=(text,source='written')=>({...tokens(room),operation:'capture',noteId:randomUUID(),text,source});
  const first=capture('An offline mindfulness practice, not a coding drill.');room=(await call('channels/'+room.id+'/premise','POST',first)).data.channel;
  const initialConfirm={...tokens(room),operation:'confirm',noteId:first.noteId};room=(await call('channels/'+room.id+'/premise','POST',initialConfirm)).data.channel;
  const correction=capture('सिर्फ mindfulness. Characters discuss it with a straight face.','spoken');room=(await call('channels/'+room.id+'/premise','POST',correction)).data.channel;restart();
  const repeat=await call('channels/'+room.id+'/premise','POST',correction);assert.equal(repeat.data.replayed,true);assert.equal(repeat.data.channel.setup.notes.length,2);
  assert.equal((await call('channels/'+room.id+'/premise','POST',{...tokens(room),operation:'confirm',noteId:first.noteId})).status,400);
  room=(await call('channels/'+room.id+'/premise','POST',{...tokens(room),operation:'confirm',noteId:correction.noteId})).data.channel;
  assert.equal(room.setup.currentNoteId,correction.noteId);assert.equal(room.setup.notes[1].text,correction.text);assert.equal(room.setup.notes[1].source,'spoken');assert.equal(room.setup.notes[1].supersedes,first.noteId);
}));
test('rich profile revisions are pinned in episode/take snapshots and later edits preserve prior accepted takes',()=>fixture(async({call,channel,person,tokens})=>{
  let room=await channel(),first=person(),lib=(await call('characters','POST',first)).data.library,second=person(lib.revision);lib=(await call('characters','POST',second)).data.library;
  room=(await call('channels/'+room.id,'PATCH',{...tokens(room),operation:'revise',definition:{...room.definition,defaultCast:[{slotId:'host',characterId:first.id},{slotId:'regular',characterId:second.id}]}})).data.channel;
  const created=await call('episodes','POST',{id:randomUUID(),requestId:randomUUID(),channelId:room.id,plan:{premise:'Two people discuss absurd meetings.'}});assert.equal(created.status,201);let episode=created.data.episode;
  episode=(await call('episodes/'+episode.id,'PATCH',{...tokens(episode),operation:'accept-take',takeId:randomUUID()})).data.episode;
  assert.equal(episode.takes[0].planSnapshot.characterSnapshots[first.id].backstory,first.profile.backstory);
  const edited=await call('characters','POST',{...first,requestId:randomUUID(),expectedRevision:lib.revision,action:'update',profile:{...first.profile,backstory:'A different approved backstory.'}});assert.equal(edited.status,200);assert.equal(edited.data.library.characters.find(actor=>actor.id===first.id).studioProfile.revision,2);
  const saved=(await call('episodes/'+episode.id)).data.episode;assert.equal(saved.takes[0].planSnapshot.characterSnapshots[first.id].backstory,first.profile.backstory);
}));
test('foreign IDs, future character stores, unapproved episode canon and corrupt profiles do not reset saved identities',()=>fixture(async({root,profileId,call,person})=>{
  const input=person(),saved=await call('characters','POST',input);assert.equal(saved.status,200);
  assert.equal((await call('characters','POST',{...input,requestId:randomUUID(),action:'update',expectedRevision:1},randomUUID())).status,409);
  assert.equal((await call('characters','POST',{...input,requestId:randomUUID(),expectedRevision:1,action:'update',profile:{...input.profile,canon:[{id:'from-show',text:'Invented memory.',visibility:'public',origin:'episode',sourceEpisodeId:randomUUID()}]}})).status,400);
  const file=path.join(root,'.sovereign','studio','v1',profileId,'characters',profileId+'.json'),original=JSON.parse(await readFile(file,'utf8'));const future=JSON.stringify({...original,schemaVersion:99});await writeFile(file,future);
  assert.equal((await call('characters')).status,409);assert.equal(await readFile(file,'utf8'),future);
}));
test('approved episode canon keeps its provenance during ordinary character edits and new memory changes still require approval',()=>fixture(async({call,channel,person,tokens})=>{
  let room=await channel(),first=person(),lib=(await call('characters','POST',first)).data.library,second=person(lib.revision);lib=(await call('characters','POST',second)).data.library;
  room=(await call('channels/'+room.id,'PATCH',{...tokens(room),operation:'revise',definition:{...room.definition,defaultCast:[{slotId:'host',characterId:first.id},{slotId:'regular',characterId:second.id}]}})).data.channel;
  const episode=(await call('episodes','POST',{id:randomUUID(),requestId:randomUUID(),channelId:room.id,plan:{premise:'A fictional committee episode.'}})).data.episode;
  const fact={id:'approved-memory',text:'Reviewed a fictional committee on this show.',visibility:'channel',channelId:room.id,origin:'episode',sourceEpisodeId:episode.id};
  let change={...first,action:'update',expectedRevision:lib.revision,requestId:randomUUID(),profile:{...first.profile,canon:[fact]},approvedCanon:true};
  const approved=await call('characters','POST',change);assert.equal(approved.status,200);lib=approved.data.library;
  const {approvedCanon,...ordinary}=change;change={...ordinary,requestId:randomUUID(),expectedRevision:lib.revision,character:{...first.character,name:'An edited name'}};
  const edited=await call('characters','POST',change);assert.equal(edited.status,200,JSON.stringify(edited));lib=edited.data.library;
  assert.equal(lib.characters.find(actor=>actor.id===first.id).studioProfile.canon[0].sourceEpisodeId,episode.id);
  const denied=await call('characters','POST',{...change,requestId:randomUUID(),expectedRevision:lib.revision,profile:{...change.profile,canon:[{...fact,text:'An unapproved new claim.'}]}});assert.equal(denied.status,400);
  assert.equal((await call('characters','POST',null)).status,400);
}));
