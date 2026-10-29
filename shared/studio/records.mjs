import {validateScreenSourceUrl} from './screen-source.mjs';
import {validateDirection} from './orchestration.mjs';
import {isId,validateRecord} from '../session-domain.mjs';
import {fields} from './validation.mjs';
import {validateChannel} from './channels.mjs';
import {planEpisode,episodeInput} from './episodes.mjs';
import {currentBrief} from '../discussion-memory.mjs';
import {validateEdition} from './edition.mjs';
import {validateProduction} from './production.mjs';
import {validateAvatarRendering} from './avatar-rendering.mjs';

const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const need=(condition,message)=>{if(!condition)throw new Error(message);};
export function validatePlan(plan){
  fields(plan,['schemaVersion','id','premise','channelId','channelSnapshot','formatId','writingMode','language','viewerMode','humanParticipant','characterSnapshots','guestAppearances','cast','media','beats','cues'],'episode plan');
  need(plan.schemaVersion===1&&plan.channelId===plan.channelSnapshot?.id,'Invalid episode snapshot.');
  need(plan.characterSnapshots&&typeof plan.characterSnapshots==='object'&&!Array.isArray(plan.characterSnapshots),'Invalid profile snapshots.');
  const ids=plan.cast?.map(member=>member.characterId)||[];
  need(Object.keys(plan.characterSnapshots).every(id=>ids.includes(id)),'A snapshot belongs outside this cast.');
  const canonical=planEpisode(episodeInput(plan),{channel:plan.channelSnapshot,characterIds:ids,characterProfiles:plan.characterSnapshots});
  need(JSON.stringify(plan.guestAppearances)===JSON.stringify(canonical.guestAppearances),'Invalid guest appearance records.');
  for(const key of ['cast','media','beats','cues'])need(plan[key].every(record=>record.schemaVersion===1),'Unversioned episode component.');
  return plan;
}
export function validateStudioRecord(record,collection){
  const common=['schemaVersion','kind','id','profileId','revision','epoch','createdAt','updatedAt','events'];
  fields(record,[...common,...(collection==='channels'?['templateId','definition','setup','screen','directionHistory']:['plan','channelRevision','status','takes','humanInputs','production','headline','storyApproval','deletedAt'])],'studio record');
  need(record.schemaVersion===1&&isId(record.id)&&isId(record.profileId),'Invalid studio identity.');
  need(record.kind===(collection==='channels'?'studio-channel':'studio-episode'),'Invalid studio kind.');
  need(integer(record.revision,1)&&integer(record.epoch)&&record.epoch<record.revision&&date(record.createdAt)&&date(record.updatedAt),'Invalid studio revision/clock.');
  need(Array.isArray(record.events)&&record.events.length===record.revision&&record.events.length<=1000,'Invalid studio event history.');
  const requests=new Set();let epoch=0;
  record.events.forEach((event,i)=>{
    fields(event,['requestId','revision','epoch','at','operation','signature'],'studio event');
    need(isId(event.requestId)&&!requests.has(event.requestId)&&event.revision===i+1&&integer(event.epoch)&&event.epoch>=epoch&&event.epoch<=epoch+1&&date(event.at)&&typeof event.operation==='string'&&/^[a-f0-9]{64}$/.test(event.signature),'Invalid studio event.');
    requests.add(event.requestId);epoch=event.epoch;
  });
  need(epoch===record.epoch,'Studio epoch does not match history.');
  if(collection==='channels'){
    need(['meme-radio','funny-news','reality-room'].includes(record.templateId),'Unknown channel template.');
    validateChannel(record.definition);need(record.definition.id===record.id,'Channel identity mismatch.');
    if(record.directionHistory!==undefined){need(Array.isArray(record.directionHistory)&&record.directionHistory.length<=20,'Invalid direction history.');for(const item of record.directionHistory){fields(item,['requestId','summary','commands','brain','at'],'saved direction');need(isId(item.requestId)&&date(item.at)&&item.brain&&typeof item.brain.provider==='string'&&typeof item.brain.model==='string'&&record.events.some(event=>event.requestId===item.requestId&&event.operation==='direction'),'Invalid saved director provenance.');validateDirection({summary:item.summary,commands:item.commands},{characterIds:item.commands.filter(command=>command.characterId).map(command=>command.characterId)});}}

    if(record.screen!==undefined&&record.screen!==null){fields(record.screen,['assetId','muted','loop','startMs','sourceUrl'],'screen');validateScreenSourceUrl(record.screen.sourceUrl);need(/^[a-f0-9]{64}$/.test(record.screen.assetId)&&typeof record.screen.muted==='boolean'&&typeof record.screen.loop==='boolean'&&Number.isFinite(record.screen.startMs)&&record.screen.startMs>=0,'Invalid saved screen.');}
    if(record.setup!==undefined){
      fields(record.setup,['schemaVersion','notes','currentNoteId'],'premise setup');need(record.setup.schemaVersion===1&&Array.isArray(record.setup.notes)&&record.setup.notes.length<=50,'Invalid premise history.');
      const notes=new Set();for(const note of record.setup.notes){fields(note,['id','text','source','status','at','supersedes'],'premise note');need(isId(note.id)&&!notes.has(note.id)&&typeof note.text==='string'&&note.text.trim()&&note.text.length<=4000&&['written','spoken','delegated'].includes(note.source)&&['captured','confirmed'].includes(note.status)&&date(note.at)&&(!note.supersedes||notes.has(note.supersedes)),'Invalid attributed premise note.');notes.add(note.id);}
      need(record.setup.currentNoteId===null||notes.has(record.setup.currentNoteId),'Unknown active premise note.');
    }
    return record;
  }
  if(record.headline!==undefined&&record.headline!==null)need(typeof record.headline==='string'&&record.headline.length<=100,'Use a screen headline of up to 100 characters.');
  if(record.deletedAt!==undefined)need(date(record.deletedAt)&&record.events.some(event=>event.operation==='delete'&&event.at===record.deletedAt),'Unattributed episode deletion.');
  need(['draft','cancelled'].includes(record.status)&&integer(record.channelRevision,1),'Invalid episode state.');
  validatePlan(record.plan);need(record.plan.id===record.id&&isId(record.plan.channelId),'Episode identity mismatch.');
  validateProduction(record.production,record);
  need(Array.isArray(record.takes)&&record.takes.length<=20&&Array.isArray(record.humanInputs)&&record.humanInputs.length<=100,'Invalid episode history.');
  const takeIds=new Set();
  for(const take of record.takes){
    fields(take,['schemaVersion','kind','id','acceptedAt','sourceRevision','epoch','channelRevision','libraryRevision','planSnapshot','castSnapshots','humanInputs','productionSnapshot','sourceTakeId','edition','avatarRendering','deletedAt'],'take');
    if(take.deletedAt!==undefined)need(date(take.deletedAt)&&record.events.some(event=>event.operation==='delete-take'&&event.at===take.deletedAt),'Unattributed version deletion.');
    if(take.avatarRendering!==undefined)validateAvatarRendering(take.avatarRendering);
    need(take.schemaVersion===1&&take.kind==='studio-take'&&isId(take.id)&&!takeIds.has(take.id)&&date(take.acceptedAt)&&integer(take.sourceRevision,1)&&take.sourceRevision<record.revision&&integer(take.epoch)&&take.epoch<=record.epoch&&integer(take.channelRevision,1)&&integer(take.libraryRevision,1),'Invalid accepted take.');
    takeIds.add(take.id);validatePlan(take.planSnapshot);
    need(take.planSnapshot.id===record.id&&Array.isArray(take.castSnapshots)&&take.castSnapshots.length===take.planSnapshot.cast.length,'Invalid take cast.');
    const ids=new Set(take.castSnapshots.map(actor=>actor.id));
    need(ids.size===take.castSnapshots.length&&take.castSnapshots.every(actor=>actor.profileId===record.profileId)&&take.planSnapshot.cast.every(member=>ids.has(member.characterId)),'Take characters do not match the cast.');
    take.castSnapshots.forEach(actor=>validateRecord(actor,'character'));
    validateProduction(take.productionSnapshot,{...record,plan:take.planSnapshot,epoch:take.epoch});if(take.edition)validateEdition(take.edition,take);if(take.sourceTakeId)need(takeIds.has(take.sourceTakeId),'Unknown source take.');
    const acceptance=record.events[take.sourceRevision];need(acceptance?.operation==='accept-take'&&acceptance.epoch===take.epoch&&acceptance.at===take.acceptedAt,'Unattributed accepted take.');
    need(Array.isArray(take.humanInputs)&&take.humanInputs.length<=100,'Invalid take human input.');
    const answers=new Set();for(const answer of take.humanInputs){validateAnswer(answer,record);need(answer.epoch===take.epoch&&!answers.has(answer.beatId)&&take.planSnapshot.beats.some(beat=>beat.id===answer.beatId&&beat.kind==='human-input'&&beat.speakerId===answer.participantId),'Stale or unrelated take human input.');answers.add(answer.beatId);}
    for(const beat of take.planSnapshot.beats.filter(beat=>beat.kind==='human-input'))need(take.humanInputs.some(answer=>answer.beatId===beat.id&&answer.participantId===beat.speakerId),'Missing take human answer.');
  }
  if(record.storyApproval!==undefined&&record.storyApproval!==null){
    fields(record.storyApproval,['takeId','approvedAt'],'story approval');
    const take=record.takes.find(item=>item.id===record.storyApproval.takeId);
    need(!record.deletedAt&&take&&!take.deletedAt&&take.productionSnapshot&&date(record.storyApproval.approvedAt)&&record.events.some(event=>event.operation==='approve-story'&&event.at===record.storyApproval.approvedAt),'Story approval requires a saved, undeleted performed version.');
  }
  const answers=new Set();for(const answer of record.humanInputs){validateAnswer(answer,record);const key=answer.epoch+'/'+answer.beatId;need(!answers.has(key),'Duplicate human answer.');answers.add(key);}
  return record;
}

function validateAnswer(answer,record){
  fields(answer,['beatId','participantId','text','source','epoch','receivedAt','revision'],'human input');
  need(typeof answer.beatId==='string'&&answer.beatId.length<=100&&typeof answer.participantId==='string'&&answer.participantId.length<=100&&typeof answer.text==='string'&&answer.text.trim()&&answer.text.length<=4000&&answer.source==='human'&&integer(answer.epoch)&&answer.epoch<=record.epoch&&date(answer.receivedAt)&&integer(answer.revision,2)&&answer.revision<=record.revision,'Invalid actual human input.');
  const event=record.events[answer.revision-1];need(event.operation==='human-input'&&event.epoch===answer.epoch,'Unattributed human response.');
}

export function legacySessionView(session){
  // Compatibility projection only: no migration, no model calls, no write-on-read.
  return {schemaVersion:1,readOnly:true,source:{kind:session.kind||'session',id:session.id,schemaVersion:session.schemaVersion,revision:session.revision},suggestedPremise:currentBrief(session)?.topic||session.scenario?.situation||session.guidance?.notes?.filter(note=>note.source==='user').map(note=>note.text).join('\n')||'',language:{primary:session.language==='hi'?'hi-IN':'en-IN',codeSwitching:true},characterIds:session.characters.map(character=>character.id),session:structuredClone(session)};
}
