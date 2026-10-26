import {SessionError,isId,prepareMutation,appendEvent,createRecord} from './session-domain.mjs';
const check=(ok,message)=>{if(!ok)throw new SessionError(message,409,'DISCUSSION_STATE');};
const text=(v,n)=>typeof v==='string'&&v.length<=n;
export const INTERVENTIONS=['clarify','simplify','example','evidence','challenge','switch-sides','summary','give-floor','say','help'];
export const discussionTurns=s=>(s.contributions||[]).filter(c=>c.discussion===true);
export const activeParticipants=s=>s.participants.filter(p=>p.active);
export function elapsedDiscussion(s,at=Date.now()) {const d=s.discussion;return d?d.elapsedMs+(d.runningSince?Math.max(0,at-Date.parse(d.runningSince)):0):0;}
export function validateDiscussion(s){
 const d=s.discussion;if(!d)return;
 check(d.schemaVersion===1&&Number.isInteger(d.turnLimit)&&d.turnLimit>=1&&d.turnLimit<=20,'Invalid discussion budget.');
 check(Number.isInteger(d.turnsUsed)&&d.turnsUsed===discussionTurns(s).length&&d.turnsUsed<=d.turnLimit,'Invalid discussion turn ledger.');
 check(Number.isSafeInteger(d.elapsedMs)&&d.elapsedMs>=0&&Number.isSafeInteger(d.nextIndex)&&d.nextIndex>=0,'Invalid discussion clock.');
 check(d.runningSince===null||typeof d.runningSince==='string'&&Number.isFinite(Date.parse(d.runningSince)),'Invalid running clock.');
 check((s.status==='running')===(d.runningSince!==null),'Discussion clock must follow its state.');
 check(text(d.reason,300)&&Array.isArray(d.interventions)&&d.interventions.length<=40,'Invalid discussion interventions.');
 for(const i of d.interventions)check(isId(i.id)&&INTERVENTIONS.includes(i.action)&&text(i.text,2000)&&(i.targetId===null||s.participants.some(p=>p.id===i.targetId))&&(i.afterId===null||s.contributions.some(c=>c.id===i.afterId))&&(i.consumedBy===null||s.contributions.some(c=>c.id===i.consumedBy))&&Number.isFinite(Date.parse(i.at)),'Invalid saved intervention.');
}
function clock(d,now){if(d.runningSince)d.elapsedMs+=Math.max(0,Date.parse(now)-Date.parse(d.runningSince));d.runningSince=null;}
export function controlDiscussion(session,mutation){
 const {operation,action='say',text:message='',characterId=null}=mutation;
 check(['start','resume','pause','stop','finish','intervene'].includes(operation),'Unknown discussion control.');
 const command=JSON.stringify({action:'discussion-control',operation,intervention:operation==='intervene'?{action,text:message,characterId}:null});
 const next=prepareMutation(session,mutation,command);if(!next)return session;const now=mutation.now||new Date().toISOString();
 check(next.scenario.mode==='discussion','Council rehearsal connects in Wave 8. Choose a discussion room for a group exchange.');
 if(operation==='start'){
  check(next.status==='ready'&&!next.discussion&&next.guidance?.setup?.confirmedAt,'Approve this setup before starting the discussion.');
  check(activeParticipants(next).length>0&&activeParticipants(next).every(p=>p.brain?.model),'Every participant needs a connected brain.');
  next.discussion={schemaVersion:1,turnLimit:20,turnsUsed:0,elapsedMs:0,runningSince:now,nextIndex:0,reason:'',interventions:[]};next.status='running';
 }else{
  const d=next.discussion;check(d&&['running','paused'].includes(next.status),'This discussion is not active.');clock(d,now);
  if(operation==='resume'){
   check(d.turnsUsed<d.turnLimit&&d.elapsedMs<next.scenario.durationMinutes*60000,'The turn or duration budget is complete. Finish to retain a partial summary.');
   check(activeParticipants(next).length>0&&activeParticipants(next).every(p=>p.brain?.model),'Choose a connected brain for each active participant.');
   d.runningSince=now;d.reason='';next.status='running';
  }else if(operation==='stop'||operation==='finish'){
   next.status=operation==='finish'?'completed':'stopped';d.reason=operation==='finish'?'Finished by the user.':'Stopped by the user.';
   const summary=[`${d.reason} ${d.turnsUsed} committed contributions.`,...activeParticipants(next).map(p=>`${next.characters.find(c=>c.id===p.characterId)?.name} (${p.role}): ${p.position||'No position recorded.'}`),'No final user decision is inferred.'].join('\n');
   next.outcomes.push(createRecord('outcome',next.profileId,{reportType:'partial',summary,references:discussionTurns(next).map(c=>c.id)},{now}));
  }else{
   next.status='paused';d.reason=operation==='pause'?'Paused by the user.':'Waiting for the user to resume.';
   if(operation==='intervene'){
    check(INTERVENTIONS.includes(action)&&text(message,2000)&&d.interventions.length<40,'Use a short supported intervention.');
    const target=characterId===null?null:activeParticipants(next).find(p=>p.characterId===characterId);check(characterId===null||target,'Choose someone in the active cast.');
    check(action!=='say'||message.trim(),'Enter your question or direction.');
    d.interventions.push({id:crypto.randomUUID(),action,text:message.trim(),targetId:target?.id||null,afterId:discussionTurns(next).at(-1)?.id||null,consumedBy:null,at:now});
   }
  }
 }
 next.epoch++;return appendEvent(next,'session.discussion-control',mutation.requestId,command,now);
}
export function nextDiscussionSpeaker(s){
 const d=s.discussion,cast=activeParticipants(s);check(d&&cast.length,'The discussion has no active cast.');
 const turns=discussionTurns(s),pending=d.interventions.filter(i=>i.consumedBy===null),target=pending.filter(i=>i.targetId).at(-1)?.targetId;
 if(target&&cast.some(p=>p.id===target))return cast.find(p=>p.id===target);
 const counts=cast.map(p=>turns.filter(t=>t.participantId===p.id).length),minimum=Math.min(...counts),question=turns.at(-1)?.questionForParticipantId;
 if(question){const index=cast.findIndex(p=>p.id===question);if(index>=0&&counts[index]<=minimum+1)return cast[index];}
 for(let i=0;i<cast.length;i++){const index=(d.nextIndex+i)%cast.length;if(counts[index]===minimum)return cast[index];}
 return cast[d.nextIndex%cast.length];
}
export function validateTurnReply(s,participant,reply){
 const turns=discussionTurns(s),first=!turns.some(t=>t.participantId===participant.id);
 check(reply&&Object.keys(reply).every(k=>['text','position','relatedIds','questionForParticipantId','kind','onTopic'].includes(k))&&text(reply.text,1800)&&reply.text.trim()&&text(reply.position,500)&&reply.position.trim(),'The model returned an incomplete contribution.');
 check(['opening','objection','answer','reflection','summary'].includes(reply.kind)&&typeof reply.onTopic==='boolean','The model omitted its contribution type.');
 check(reply.onTopic,'The model flagged this turn as off topic. Redirect or choose another brain before resuming.');
 check(Array.isArray(reply.relatedIds)&&reply.relatedIds.length<=3&&new Set(reply.relatedIds).size===reply.relatedIds.length&&reply.relatedIds.every(id=>turns.some(t=>t.id===id)),'The model referenced an unavailable contribution.');
 check(reply.questionForParticipantId===null||activeParticipants(s).some(p=>p.id===reply.questionForParticipantId&&p.id!==participant.id),'The model addressed someone outside this cast.');
 if(!first&&turns.length&&reply.kind!=='summary')check(reply.relatedIds.length>0,'The response needs a reference to the argument it addresses.');
 const normalise=t=>t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 check(!turns.some(t=>normalise(t.text)===normalise(reply.text)),'This contribution repeats a committed turn. Redirect before resuming.');
 return reply;
}
export function recordDiscussionTurn(session,mutation){
 const command=JSON.stringify({action:'discussion-turn'}),next=prepareMutation(session,mutation,command);if(!next)return session;
 const d=next.discussion;check(d&&next.status==='running'&&mutation.epoch===next.epoch,'The discussion was paused or changed before this turn finished.');
 check(d.turnsUsed<d.turnLimit&&elapsedDiscussion(next,Date.parse(mutation.now||new Date().toISOString()))<next.scenario.durationMinutes*60000,'The discussion budget has been reached.');
 const participant=nextDiscussionSpeaker(next);check(participant.id===mutation.participantId,'The floor changed before this reply completed.');
 const reply=validateTurnReply(next,participant,mutation.reply),now=mutation.now||new Date().toISOString();
 const contribution=createRecord('contribution',next.profileId,{participantId:participant.id,requestId:mutation.requestId,epoch:next.epoch,text:reply.text,brain:mutation.brain,relatedIds:reply.relatedIds,discussion:true,turnKind:reply.kind,position:reply.position,questionForParticipantId:reply.questionForParticipantId},{now});
 next.contributions.push(contribution);participant.position=reply.position;participant.updatedAt=now;
 for(const i of d.interventions)if(i.consumedBy===null)i.consumedBy=contribution.id;
 d.turnsUsed++;d.nextIndex=(activeParticipants(next).findIndex(p=>p.id===participant.id)+1)%activeParticipants(next).length;
 return appendEvent(next,'session.discussion-turn',mutation.requestId,command,now);
}
