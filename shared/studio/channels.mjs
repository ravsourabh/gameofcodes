import {sameReviewModel} from './editorial.mjs';
import {fields, text, token, array, language} from './validation.mjs';
import {validateAvatarRendering} from './avatar-rendering.mjs';
// Channel identity, physical set and programme format are independent definitions.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const definitions=values=>freeze(Object.fromEntries(Object.entries(values).map(([id,value])=>[id,{schemaVersion:1,...value}])));
export const ROOM_SETS=definitions({
  'radio-desk':{id:'radio-desk',rendererId:'studio.radio-desk',layout:'host-desk',seats:4,props:['desk','chair','microphone','notes','cup'],screens:[{id:'main-screen',role:'meme-or-clip',accepts:['image','video','live-stream']}]},
  'news-panel':{id:'news-panel',rendererId:'studio.news-panel',layout:'roundtable',seats:5,props:['desk','chair','microphone','notes'],screens:[{id:'main-screen',role:'source-feed',accepts:['image','video','live-stream']},{id:'source-screen',role:'source-and-date',accepts:['image']}]},
  'reality-stage':{id:'reality-stage',rendererId:'studio.reality-stage',layout:'stage-and-sofa',seats:5,props:['chair','microphone'],screens:[{id:'main-screen',role:'challenge-or-replay',accepts:['image','video','live-stream']}]},
});
export const FORMATS=definitions({
  'deadpan-meme':{id:'deadpan-meme',writingModes:['scripted','hybrid','improvised'],defaultWritingMode:'improvised',tone:'satire',sourcePolicy:'fiction-or-reviewed',interruptionPolicy:'director-only',segments:['setup','clip','panel','payoff']},
  'funny-news':{id:'funny-news',writingModes:['scripted','hybrid'],defaultWritingMode:'hybrid',tone:'funny',sourcePolicy:'reviewed-news',interruptionPolicy:'bounded',segments:['source-readback','clip','commentary','recap']},
  'serious-news':{id:'serious-news',writingModes:['scripted','hybrid'],defaultWritingMode:'scripted',tone:'serious',sourcePolicy:'reviewed-news',interruptionPolicy:'moderated',segments:['source-readback','report','questions','recap']},
  'reality-show':{id:'reality-show',writingModes:['scripted','hybrid','improvised'],defaultWritingMode:'improvised',tone:'mixed',sourcePolicy:'fiction-or-reviewed',interruptionPolicy:'bounded',segments:['opening','challenge','reactions','result']},
  'participant-show':{id:'participant-show',writingModes:['hybrid','improvised'],defaultWritingMode:'hybrid',tone:'mixed',sourcePolicy:'fiction-or-reviewed',interruptionPolicy:'moderated',segments:['opening','challenge','human-answer','follow-up','judges','result']},
});
const slots=(hostPersona,guestCount)=>[{id:'host',role:'Host',membership:'permanent',persona:hostPersona},{id:'regular',role:'Regular panellist',membership:'permanent',persona:'recurring-counterpoint'},{id:'rotating',role:'Rotating panellist',membership:'rotating',optional:true},...Array.from({length:guestCount},(_,i)=>({id:'guest-'+(i+1),role:'Guest',membership:'guest',optional:true}))];
export const CHANNELS=freeze({
  'meme-radio':{schemaVersion:1,id:'meme-radio',name:'बात का बवाल',setId:'radio-desk',formatIds:['deadpan-meme'],defaultFormatId:'deadpan-meme',viewerModes:['director'],language:{primary:'hi-IN',codeSwitching:true},cast:slots('vintage-hindi-radio-host',1),voiceDirection:{archetype:'measured vintage Hindi radio announcer',pace:'relaxed',audioEffect:'radio-optional'},disclosure:'Fictional AI satire'},
  'funny-news':{schemaVersion:1,id:'funny-news',name:'The News and the Nonsense',setId:'news-panel',formatIds:['funny-news','serious-news'],defaultFormatId:'funny-news',language:{primary:'hi-IN',codeSwitching:true},cast:slots('straight-faced-news-host',2),voiceDirection:{archetype:'clear conversational presenter',pace:'balanced',audioEffect:'none'},disclosure:'AI characters; reporting and commentary identified separately'},
  'reality-room':{schemaVersion:1,id:'reality-room',name:'The Reality Room',setId:'reality-stage',formatIds:['reality-show','participant-show'],defaultFormatId:'reality-show',viewerModes:['director','participant'],language:{primary:'en-IN',codeSwitching:true},cast:slots('reality-show-presenter',2),voiceDirection:{archetype:'energetic original presenter',pace:'balanced',audioEffect:'none'},disclosure:'Fictional AI reality show'},
});
export function validateChannel(channel){
  fields(channel,['schemaVersion','id','name','setId','formatIds','defaultFormatId','viewerModes','language','cast','voiceDirection','disclosure','defaultCast','orchestrationBrain','writingBrain','reviewingBrain','writerNotes','adultComedy','avatarRendering'],'channel');
  if(!channel||channel.schemaVersion!==1||typeof channel.id!=='string'||!channel.id||typeof channel.name!=='string'||!channel.name.trim())throw new Error('A channel needs a versioned identity.');
  token(channel.id);text(channel.name,120,'channel name');
  const set=Object.hasOwn(ROOM_SETS,channel.setId)&&ROOM_SETS[channel.setId];if(!set)throw new Error('Unknown room set.');
  if(!Array.isArray(channel.formatIds)||!channel.formatIds.length||channel.formatIds.length>5||new Set(channel.formatIds).size!==channel.formatIds.length||channel.formatIds.some(id=>!Object.hasOwn(FORMATS,id))||!channel.formatIds.includes(channel.defaultFormatId))throw new Error('Choose registered channel formats.');
  if(channel.viewerModes!==undefined&&(!Array.isArray(channel.viewerModes)||!channel.viewerModes.length||channel.viewerModes.some(mode=>!['director','participant'].includes(mode))))throw new Error('Choose director or participant view.');
  if(channel.adultComedy!==undefined&&typeof channel.adultComedy!=='boolean')throw new Error('Choose whether 18+ comedy is enabled.');
  if(channel.avatarRendering!==undefined)validateAvatarRendering(channel.avatarRendering);
  if(channel.writerNotes!==undefined)text(channel.writerNotes,4000,'writer notes',true);
  if(channel.reviewingBrain!=null){fields(channel.reviewingBrain,['provider','model'],'review model');text(channel.reviewingBrain.provider,80,'review provider');text(channel.reviewingBrain.model,160,'review model');}
  if(channel.writingBrain!=null){fields(channel.writingBrain,['provider','model'],'writing model');text(channel.writingBrain.provider,80,'writer provider');text(channel.writingBrain.model,160,'writer model');}
  if(sameReviewModel(channel.reviewingBrain,channel.writingBrain))throw new Error('Choose a Script reviewer different from the dialogue writer.');
  if(channel.orchestrationBrain!=null){fields(channel.orchestrationBrain,['provider','model'],'orchestration model');text(channel.orchestrationBrain.provider,80,'provider');text(channel.orchestrationBrain.model,160,'model');}
  language(channel.language);
  fields(channel.voiceDirection,['archetype','pace','audioEffect'],'voice direction');
  for(const value of Object.values(channel.voiceDirection))text(value,250,'voice direction');
  for(const key of ['archetype','pace','audioEffect'])text(channel.voiceDirection[key],250,'voice direction');
  text(channel.disclosure,500,'disclosure');
  if(!Array.isArray(channel.cast)||channel.cast.length>set.seats||!channel.cast.some(slot=>slot.role==='Host'&&slot.membership==='permanent'&&!slot.optional))throw new Error('The cast needs a permanent host and enough seats.');
  const slots=new Set();for(const slot of channel.cast){
    fields(slot,['id','role','membership','persona','optional'],'cast slot');token(slot.id);text(slot.role,120,'cast role');
    if(slot.persona!==undefined)text(slot.persona,500,'cast persona');
    if(slot.optional!==undefined&&typeof slot.optional!=='boolean')throw new Error('Invalid optional cast slot.');
    if(slots.has(slot.id)||!['permanent','rotating','guest'].includes(slot.membership))throw new Error('Invalid or duplicate cast slot.');slots.add(slot.id);
  }
  const defaults=new Set(),actors=new Set();
  for(const member of array(channel.defaultCast===undefined?[]:channel.defaultCast,set.seats,'default cast')){
    fields(member,['slotId','characterId'],'default cast');token(member.characterId);
    if(!slots.has(member.slotId)||defaults.has(member.slotId)||actors.has(member.characterId)||channel.cast.find(slot=>slot.id===member.slotId).membership==='guest')throw new Error('Use distinct regular characters for channel defaults; guests belong to episodes.');
    defaults.add(member.slotId);actors.add(member.characterId);
  }
  return channel;
}

// These are registered contracts, not a claim that their renderers/feeds exist.
export function studioCatalogue(){
  return structuredClone({schemaVersion:1,recordVersions:{Channel:1,RoomSet:1,Format:1,CharacterProfile:1,Episode:1,RundownBeat:1,CastAssignment:1,GuestAppearance:1,MediaSource:1,PerformanceCue:1,Take:1},templates:CHANNELS,roomSets:Object.fromEntries(Object.entries(ROOM_SETS).map(([id,set])=>[id,{schemaVersion:1,...set,status:'planned',anchors:{director:'camera.director',...(id==='reality-stage'?{participant:'stage.participant',judges:'stage.judges'}:{})}}])),formats:Object.fromEntries(Object.entries(FORMATS).map(([id,format])=>[id,{schemaVersion:1,...format,status:'planned'}])),capabilities:{persistence:true,legacyReadOnly:true,characterProfiles:true,reusableCharacters:true,premiseCapture:true,channelWorkspace:true,performance:true,fullPerformance:false,preparedConversation:true,mediaPlayback:true,mediaTimeline:false,mediaPerception:false,recording:true,export:true,directedCameras:true,orchestration:true,practice:true,liveBroadcast:false}});
}
