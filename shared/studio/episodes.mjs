import {validateChannel,FORMATS,ROOM_SETS} from './channels.mjs';
import {validateCues} from './actions.mjs';
import {validateCharacterProfile} from './characters.mjs';
import {fields,versioned,text,token,language as validateLanguage} from './validation.mjs';

export const EPISODE_FIELDS=['id','premise','formatId','writingMode','language','viewerMode','humanParticipant','cast','media','beats','cues'];
export function episodeInput(plan){return Object.fromEntries(EPISODE_FIELDS.filter(key=>plan[key]!==undefined).map(key=>[key,structuredClone(plan[key])]));}

// Pure validation/planning: no inference, rendering, network, storage or publication.
export function planEpisode(input,{channel,characterIds,characterProfiles={}}){
  validateChannel(channel);
  fields(input,EPISODE_FIELDS,'episode');token(input.id,'episode identifier');
  if(!input||typeof input.id!=='string'||!input.id||typeof input.premise!=='string'||!input.premise.trim()||input.premise.length>4000)throw new Error('Write or narrate a bounded episode premise.');
  const formatId=input.formatId||channel.defaultFormatId,format=FORMATS[formatId];
  if(!channel.formatIds.includes(formatId))throw new Error('That format is not enabled on this channel.');
  const writingMode=input.writingMode||format.defaultWritingMode;
  if(!format.writingModes.includes(writingMode))throw new Error('That writing mode is not enabled for this format.');
  const viewerMode=input.viewerMode||'director';
  if(!(channel.viewerModes||['director']).includes(viewerMode))throw new Error('That viewer mode is not enabled for this channel.');
  const human=input.humanParticipant;
  if(viewerMode==='participant'&&(!human||typeof human.id!=='string'||!human.id||typeof human.displayName!=='string'||!human.displayName.trim()||characterIds.includes(human.id)))throw new Error('Participant mode needs a separate human identity, not an AI character.');
  if(human){fields(human,['id','displayName'],'human participant');token(human.id);text(human.displayName,120,'participant name');}
  if(viewerMode!=='participant'&&human!==undefined)throw new Error('Human participation must be explicitly selected.');
  const language=input.language||channel.language;
  validateLanguage(language);
  if(!Array.isArray(input.cast))throw new Error('Choose the episode cast.');
  const used=new Set(),slotIds=new Set();
  for(const member of input.cast){
    versioned(member,['slotId','characterId','enterAtBeatId','leaveAfterBeatId'],'cast assignment');
    if(!channel.cast.some(slot=>slot.id===member.slotId)||slotIds.has(member.slotId)||!characterIds.includes(member.characterId)||used.has(member.characterId))throw new Error('Use distinct known characters in existing cast slots.');
    used.add(member.characterId);slotIds.add(member.slotId);
  }
  for(const slot of channel.cast)if(!slot.optional&&!slotIds.has(slot.id))throw new Error(`Fill the required cast slot: ${slot.id}`);
  const media=input.media===undefined?[]:input.media,mediaIds=new Set();
  if(!Array.isArray(media)||media.length>8)throw new Error('An episode supports at most eight media sources.');
  for(const item of media){
    versioned(item,['id','kind','review','sourceUrl','publishedAt','perception','transcript','frameAssetIds'],'media source');token(item.id);
    if(!item||typeof item.id!=='string'||!item.id||mediaIds.has(item.id)||!['image','video','live-stream'].includes(item.kind)||!['fictional','reviewed','pending'].includes(item.review))throw new Error('Invalid media identity, kind or review status.');mediaIds.add(item.id);
    if(item.perception!==undefined&&!['none','transcript','frames'].includes(item.perception))throw new Error('Unknown media perception mode.');
    if(item.transcript!==undefined)text(item.transcript,12000,'media transcript');
    if(item.perception==='transcript'&&(typeof item.transcript!=='string'||!item.transcript.trim()))throw new Error('Transcript perception needs actual supplied text.');
    if(item.perception==='frames'&&(!Array.isArray(item.frameAssetIds)||!item.frameAssetIds.length||item.frameAssetIds.some(id=>typeof id!=='string'||!id)))throw new Error('Frame perception needs actual sampled frame assets.');
    if(item.review==='reviewed'&&(!item.sourceUrl||!Number.isFinite(Date.parse(item.publishedAt))))throw new Error('Reviewed real-world material needs a source and publication date.');
    if(item.frameAssetIds!==undefined){if(!Array.isArray(item.frameAssetIds)||item.frameAssetIds.length>24)throw new Error('Use at most 24 sampled frames.');item.frameAssetIds.forEach(id=>token(id,'frame asset'));}
    if(item.sourceUrl){text(item.sourceUrl,2048,'source URL');let url;try{url=new URL(item.sourceUrl);}catch{throw new Error('Invalid media source URL.');}if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use an HTTPS source reference without credentials.');}
  }
  if(format.sourcePolicy==='reviewed-news'&&(!media.some(item=>item.review==='reviewed')||media.some(item=>item.review==='pending')))throw new Error('Review dated news sources before planning a news episode.');
  const beats=input.beats===undefined?[]:input.beats,beatIds=new Set();
  if(!Array.isArray(beats)||beats.length>100)throw new Error('An episode supports at most 100 rundown beats.');
  for(const beat of beats){
    versioned(beat,['id','segment','speakerId','text','mediaId','kind','origin','locked'],'rundown beat');token(beat.id);
    if(beat.origin!==undefined&&!['authored','generated'].includes(beat.origin)||beat.locked!==undefined&&typeof beat.locked!=='boolean')throw new Error('Invalid rundown authorship.');
    if(beat.kind!==undefined&&!['speech','media','action','human-input'].includes(beat.kind))throw new Error('Unknown rundown beat kind.');
    if(typeof beat.id!=='string'||!beat.id||beatIds.has(beat.id)||!format.segments.includes(beat.segment))throw new Error('A rundown beat needs a unique ID and a permitted segment.');beatIds.add(beat.id);
    if(human&&beat.speakerId===human.id){if(beat.kind!=='human-input'||beat.text!==undefined)throw new Error('A human turn waits for actual input; do not invent a human answer.');}
    else if(beat.kind==='human-input'||beat.speakerId!==undefined&&!used.has(beat.speakerId))throw new Error('A beat references someone outside the episode cast.');
    if(beat.text!==undefined&&(typeof beat.text!=='string'||beat.text.length>4000))throw new Error('Use a bounded script line.');
    if(beat.kind==='media'&&(!beat.mediaId||beat.speakerId!==undefined||beat.text!==undefined))throw new Error('A media beat needs a source, separate from a speech line.');
    if(beat.kind==='action'&&(beat.text!==undefined||beat.speakerId!==undefined))throw new Error('An action beat uses explicit performance cues.');
    if(writingMode==='scripted'&&![ 'media','action','human-input'].includes(beat.kind)&&(!beat.speakerId||!beat.text?.trim()))throw new Error('Every scripted speech beat needs a speaker and a line.');
    if(beat.mediaId!==undefined&&!mediaIds.has(beat.mediaId))throw new Error('A beat references unknown media.');
  }
  if(writingMode==='scripted'&&!beats.length)throw new Error('A scripted episode needs an authored rundown.');
  for(const member of input.cast){const slot=channel.cast.find(slot=>slot.id===member.slotId);if(slot.membership==='guest'){
    const start=beats.findIndex(beat=>beat.id===member.enterAtBeatId),end=beats.findIndex(beat=>beat.id===member.leaveAfterBeatId);
    if(start<0||end<start)throw new Error('A guest needs valid entrance and exit beats.');
    if(beats.some((beat,index)=>beat.speakerId===member.characterId&&(index<start||index>end)))throw new Error('A guest cannot speak outside their appearance.');
  }}
  const targetIds=[...ROOM_SETS[channel.setId].props,...ROOM_SETS[channel.setId].screens.map(screen=>screen.id)];
  validateCues(input.cues===undefined?[]:input.cues,{characterIds:[...used],targetIds});
  for(const cue of input.cues||[]){
    if(cue.beatId!==undefined&&!beatIds.has(cue.beatId))throw new Error('A performance cue references an unknown rundown beat.');
    const member=input.cast.find(member=>member.characterId===cue.characterId),slot=channel.cast.find(slot=>slot.id===member.slotId);
    if(slot.membership==='guest'){const index=beats.findIndex(beat=>beat.id===cue.beatId),start=beats.findIndex(beat=>beat.id===member.enterAtBeatId),end=beats.findIndex(beat=>beat.id===member.leaveAfterBeatId);if(index<start||index>end)throw new Error('A guest performance cue must be inside their appearance beats.');}
  }
  for(const beat of beats)if(beat.kind==='action'&&!(input.cues||[]).some(cue=>cue.beatId===beat.id))throw new Error('An action beat needs an explicit performance cue.');
  const characterSnapshots={};for(const id of used)if(characterProfiles[id]){const profile=validateCharacterProfile(characterProfiles[id]);if(profile.characterId!==id)throw new Error('A profile belongs to a different character.');characterSnapshots[id]=profile;}
  const stamp=record=>({schemaVersion:1,...record});
  const guestAppearances=input.cast.filter(member=>channel.cast.find(slot=>slot.id===member.slotId).membership==='guest').map(member=>({schemaVersion:1,slotId:member.slotId,characterId:member.characterId,enterAtBeatId:member.enterAtBeatId,leaveAfterBeatId:member.leaveAfterBeatId}));
  return structuredClone({schemaVersion:1,id:input.id,premise:input.premise,channelId:channel.id,channelSnapshot:channel,formatId,writingMode,language,viewerMode,...(human?{humanParticipant:human}:{}),characterSnapshots,guestAppearances,cast:input.cast.map(stamp),media:media.map(stamp),beats:beats.map(stamp),cues:(input.cues||[]).map(stamp)});
}

export function mediaKnowledge(item){
  return {id:item.id,kind:item.kind,review:item.review,sourceUrl:item.sourceUrl||null,publishedAt:item.publishedAt||null,
    hasPerceptionInput:item.perception==='transcript'&&!!item.transcript?.trim()||item.perception==='frames'&&!!item.frameAssetIds?.length,
    transcript:item.perception==='transcript'?item.transcript:null,frameAssetIds:item.perception==='frames'?item.frameAssetIds:[]};
}
