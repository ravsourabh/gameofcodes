import {SessionError,prepareMutation,appendEvent,isId} from './session-domain.mjs';
export function recordCutOff(s,m){
 const {previousId,interruptedBy,atSeconds,durationSeconds,source='audio'}=m;
 if(!isId(previousId)||!isId(interruptedBy)||!Number.isFinite(atSeconds)||atSeconds<=0||atSeconds>300||!['audio','device'].includes(source)||!(source==='device'&&durationSeconds===null||Number.isFinite(durationSeconds)&&durationSeconds<=300&&atSeconds<durationSeconds))throw new SessionError('Use actual interrupted playback timing.',400);
 const command=JSON.stringify({action:'cut-off',previousId,interruptedBy,atSeconds,durationSeconds,source}),next=prepareMutation(s,m,command);if(!next)return s;
 const turns=next.contributions.filter(c=>c.discussion),index=turns.findIndex(c=>c.id===previousId),previous=turns[index],following=turns[index+1];
 if(next.showRoom!=='heated'||index<0||index%3===2||following?.id!==interruptedBy||following.participantId===previous.participantId||previous.cutOff)throw new SessionError('This room or turn does not permit that cut-in.',409);
 previous.cutOff={by:interruptedBy,atSeconds,durationSeconds,source};return appendEvent(next,'session.performance',m.requestId,command,m.now||new Date().toISOString());
}
