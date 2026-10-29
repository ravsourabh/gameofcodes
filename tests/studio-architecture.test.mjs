import test from 'node:test';import assert from 'node:assert/strict';
import {ACTIONS,CHANNELS,characterActions,validateCues,validateChannel,planEpisode,mediaKnowledge,visibleCharacterFacts,validateCharacterProfile} from '../shared/studio/index.mjs';
const actors=['host-a','regular-b','rotating-c','guest-d'];
const cast=[{slotId:'host',characterId:actors[0]},{slotId:'regular',characterId:actors[1]}];
const episode=(extra={})=>({id:'episode-1',premise:'A panel debates whether cancelling meetings requires another meeting.',cast,...extra});
const cue=(extra={})=>({id:'cue-1',characterId:actors[0],actionId:'speaking.open-palms',atMs:0,durationMs:1500,intensity:.4,...extra});
test('every character gets the complete shared vocabulary, with explicit missing asset/prop status',()=>{
  assert.equal(new Set(ACTIONS.map(action=>action.id)).size,ACTIONS.length);assert.ok(ACTIONS.length>100);
  assert.deepEqual(characterActions(actors[0]).map(c=>c.actionId),characterActions(actors[1]).map(c=>c.actionId));
  assert.equal(characterActions(actors[0]).find(c=>c.actionId==='fatigue.sleep-on-desk').status,'needs-animation');
  const bindings={'fatigue.sleep-on-desk':{validated:true}};
  assert.equal(characterActions(actors[0],{bindings}).find(c=>c.actionId==='fatigue.sleep-on-desk').status,'needs-prop');
  assert.equal(characterActions(actors[0],{bindings,props:['desk']}).find(c=>c.actionId==='fatigue.sleep-on-desk').status,'ready');
});
test('performance lanes allow a facial reaction with a hand gesture and reject incompatible body actions',()=>{
  assert.equal(validateCues([cue(),cue({id:'face',actionId:'expression.smile'})],{characterIds:actors}).length,2);
  assert.throws(()=>validateCues([cue({actionId:'celebration.dance'}),cue({id:'sleep',actionId:'fatigue.sleep-on-desk'})],{characterIds:actors}),/Conflicting/);
  assert.throws(()=>validateCues([cue({characterId:'foreign-person'})],{characterIds:actors}),/outside/);
  assert.throws(()=>validateCues([cue({actionId:'execute-arbitrary-command'})],{characterIds:actors}),/Unknown/);
  assert.throws(()=>validateCues([cue({actionId:'social.handshake',targetId:'missing'})],{characterIds:actors}),/existing/);
});
test('channel presets keep room sets, show formats, language and episode snapshots independent',()=>{
  Object.values(CHANNELS).forEach(validateChannel);
  const channel=structuredClone(CHANNELS['meme-radio']);const plan=planEpisode(episode(),{channel,characterIds:actors});
  channel.name='An edited channel';assert.notEqual(plan.channelSnapshot.name,channel.name);assert.equal(plan.language.primary,'hi-IN');
  assert.throws(()=>planEpisode(episode({formatId:'serious-news'}),{channel,characterIds:actors}),/not enabled/);
  assert.throws(()=>planEpisode(episode({cast:[{slotId:'regular',characterId:actors[1]}]}),{channel,characterIds:actors}),/required cast/);
  assert.throws(()=>planEpisode(episode({writingMode:'scripted'}),{channel,characterIds:actors}),/authored rundown/);
});
test('news episodes require reviewed dated sources, while a media URL alone does not mean a character watched it',()=>{
  const channel=CHANNELS['funny-news'],source={id:'source-1',kind:'video',review:'reviewed',sourceUrl:'https://example.org/report',publishedAt:'2026-10-27T00:00:00Z'};
  assert.throws(()=>planEpisode(episode(),{channel,characterIds:actors}),/Review dated/);
  assert.equal(planEpisode(episode({media:[source]}),{channel,characterIds:actors}).media.length,1);
  assert.equal(mediaKnowledge(source).hasPerceptionInput,false);assert.equal(mediaKnowledge({...source,perception:'transcript',transcript:'Supplied clip transcript.'}).hasPerceptionInput,true);
  assert.throws(()=>planEpisode(episode({media:[{...source,perception:'frames'}]}),{channel,characterIds:actors}),/sampled frame/);
});
test('guests have explicit appearance windows and rotating choices remain explicit across episodes',()=>{
  const channel=CHANNELS['reality-room'],beats=[{id:'opening',segment:'opening',speakerId:actors[0]},{id:'challenge',segment:'challenge',speakerId:actors[3]},{id:'close',segment:'result',speakerId:actors[0]}];
  const guests=[...cast,{slotId:'guest-1',characterId:actors[3],enterAtBeatId:'challenge',leaveAfterBeatId:'challenge'}];
  const plan=planEpisode(episode({cast:guests,beats}),{channel,characterIds:actors});assert.equal(plan.writingMode,'improvised');
  assert.throws(()=>planEpisode(episode({cast:guests,beats:[{...beats[0],speakerId:actors[3]},...beats.slice(1)]}),{channel,characterIds:actors}),/outside their appearance/);
  assert.throws(()=>planEpisode(episode({cast:[...cast,{slotId:'guest-1',characterId:actors[3]}],beats}),{channel,characterIds:actors}),/entrance and exit/);
  assert.throws(()=>planEpisode(episode({cast:guests,beats,cues:[cue({characterId:actors[3],beatId:'close'})]}),{channel,characterIds:actors}),/inside their appearance/);
  assert.equal(planEpisode(episode({cast:guests,beats,cues:[cue({characterId:actors[3],beatId:'challenge'})]}),{channel,characterIds:actors}).cues.length,1);
});
test('rich character profiles preserve episode snapshots and disclose only known public/channel canon',()=>{
  const profile={schemaVersion:1,characterId:actors[0],revision:1,behaviour:{speechStyle:'Measured deadpan Hindi',habits:['Straightens the microphone'],energy:.3},psychology:{traits:['Literal','Patient'],motivations:['Keep the programme orderly'],values:['Fairness'],stressResponse:'Becomes more formal',conflictStyle:'Asks a precise question'},likes:['Old radio programmes'],dislikes:['Unnecessary meetings'],backstory:'A fictional veteran presenter who once hosted a very dull conference.',canon:[{id:'radio',text:'Collects old radios.',visibility:'public',origin:'creator'},{id:'episode',text:'Once fell asleep during this channel’s committee segment.',visibility:'channel',channelId:'meme-radio',origin:'episode',sourceEpisodeId:'old-episode'},{id:'private',text:'A private character motivation.',visibility:'private',origin:'creator'}]};
  validateCharacterProfile(profile);assert.deepEqual(visibleCharacterFacts(profile).map(f=>f.id),['radio']);assert.deepEqual(visibleCharacterFacts(profile,{channelId:'meme-radio',knownFactIds:['episode','private']}).map(f=>f.id),['radio','episode']);assert.deepEqual(visibleCharacterFacts(profile,{channelId:'another-channel',knownFactIds:['episode']}).map(f=>f.id),['radio']);
  const plan=planEpisode(episode(),{channel:CHANNELS['meme-radio'],characterIds:actors,characterProfiles:{[actors[0]]:profile}});profile.dislikes[0]='An edited preference';assert.equal(plan.characterSnapshots[actors[0]].dislikes[0],'Unnecessary meetings');
});
test('participant mode keeps the human separate from AI cast and waits for actual human answers',()=>{
  const input=episode({formatId:'participant-show',viewerMode:'participant',humanParticipant:{id:'human-1',displayName:'Creator'},beats:[{id:'question',segment:'challenge',speakerId:actors[0]},{id:'answer',segment:'human-answer',kind:'human-input',speakerId:'human-1'}]});
  const plan=planEpisode(input,{channel:CHANNELS['reality-room'],characterIds:actors});assert.equal(plan.viewerMode,'participant');assert.equal(plan.humanParticipant.id,'human-1');assert.equal(plan.cast.some(member=>member.characterId==='human-1'),false);
  assert.throws(()=>planEpisode({...input,beats:[input.beats[0],{...input.beats[1],text:'An invented answer from the user.'}]},{channel:CHANNELS['reality-room'],characterIds:actors}),/do not invent/);
  assert.throws(()=>planEpisode({...input,formatId:'deadpan-meme'},{channel:CHANNELS['meme-radio'],characterIds:actors}),/viewer mode/);
});
test('episode components have independent versions and scripted media/action beats do not require invented speech',()=>{
  const channel=CHANNELS['meme-radio'];
  const input=episode({writingMode:'scripted',media:[{id:'meme',kind:'image',review:'fictional'}],beats:[{id:'line',segment:'setup',speakerId:actors[0],text:'The committee has arrived.'},{id:'clip',segment:'clip',kind:'media',mediaId:'meme'},{id:'reaction',segment:'panel',kind:'action'}],cues:[cue({beatId:'reaction'})]});
  const plan=planEpisode(input,{channel,characterIds:actors});
  for(const key of ['cast','media','beats','cues'])assert.ok(plan[key].every(record=>record.schemaVersion===1));
  assert.equal(plan.beats[1].speakerId,undefined);assert.equal(plan.beats[2].text,undefined);
  assert.throws(()=>planEpisode({...input,beats:[{...input.beats[0],schemaVersion:2}]},{channel,characterIds:actors}),/Unsupported/);
  assert.throws(()=>planEpisode({...input,media:false},{channel,characterIds:actors}),/media sources/);
  assert.throws(()=>planEpisode({...input,cues:[]},{channel,characterIds:actors}),/explicit performance cue/);
});
