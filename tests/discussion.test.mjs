import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createSession,updateRoster,assignCharacter} from '../shared/session-domain.mjs';
import {generateCharacter} from '../shared/character-domain.mjs';
import {changeSetup} from '../shared/setup-domain.mjs';
import {controlDiscussion,nextDiscussionSpeaker,recordDiscussionTurn,elapsedDiscussion} from '../shared/discussion-domain.mjs';
export function readyDiscussion(){
 const profileId=randomUUID(),guide=generateCharacter(profileId,{guide:true}),brain={provider:'fixture',model:'requested'},voice={provider:'browser',id:'default'};guide.brain=brain;guide.voice=voice;
 let s=createSession({profileId,guide,requestId:randomUUID(),draft:{title:'A choice',mode:'discussion',situation:''}});
 const people=[generateCharacter(profileId,{seed:1}),generateCharacter(profileId,{seed:2}),generateCharacter(profileId,{seed:3})];people.forEach(c=>{c.brain=brain;c.voice=voice;});
 s=updateRoster(s,{requestId:randomUUID(),expectedRevision:s.revision,entries:people.map((c,i)=>({characterId:c.id,role:['Proponent','Sceptic','Practical reviewer'][i]}))},people);
 const guideChange=(op,payload={})=>{s=changeSetup(s,{requestId:randomUUID(),expectedRevision:s.revision,operation:op,payload});};
 guideChange('capture',{text:'Should we fund the pilot?'});guideChange('propose',{brain,proposal:{title:'Fund the pilot',mode:'discussion',format:'hearing',intensity:'probing',situation:'Should we fund the pilot?',goal:'Understand the tradeoffs.',constraints:[],durationMinutes:10,rubric:[{name:'Evidence',description:'Separate facts and assumptions.'}],cast:[{name:'Alex',role:'Reviewer',reason:'Check the tradeoffs.',code:'Evidence first.',personality:'Curious'}]}});guideChange('confirm-notes');guideChange('approve');return s;
}
export const control=(s,operation,fields={})=>controlDiscussion(s,{requestId:randomUUID(),expectedRevision:s.revision,operation,...fields});
export function reply(s,text='A distinct point.',fields={}){return {text,position:text,kind:s.discussion.turnsUsed?'answer':'opening',relatedIds:s.contributions.slice(-1).map(c=>c.id),questionForParticipantId:null,onTopic:true,...fields};}
export const turn=(s,r)=>recordDiscussionTurn(s,{requestId:randomUUID(),expectedRevision:s.revision,epoch:s.epoch,participantId:nextDiscussionSpeaker(s).id,reply:r,brain:{provider:'fixture',model:'resolved'}});
test('discussion requires explicit start, balances participants and commits real referenced objections and answers',()=>{
 let s=readyDiscussion();assert.equal(s.status,'ready');assert.equal(s.discussion,undefined);s=control(s,'start');const ids=[];
 for(let i=0;i<3;i++){ids.push(nextDiscussionSpeaker(s).id);s=turn(s,reply(s,`Opening point ${i}.`,{kind:'opening'}));}assert.equal(new Set(ids).size,3);
 const before=s.contributions.at(-1);s=turn(s,reply(s,'The cost estimate omits recruitment.',{kind:'objection',relatedIds:[before.id],questionForParticipantId:before.participantId}));assert.equal(nextDiscussionSpeaker(s).id,before.participantId);
 s=turn(s,reply(s,'Include recruitment in a capped pilot budget.',{relatedIds:[s.contributions.at(-1).id]}));assert.equal(s.contributions.at(-1).brain.model,'resolved');assert.equal(s.participants.find(p=>p.id===before.participantId).position,'Include recruitment in a capped pilot budget.');
});
test('pause and intervention invalidate pending replies and preserve a directed next turn without auto-resume',()=>{
 let s=control(readyDiscussion(),'start');const pending={requestId:randomUUID(),expectedRevision:s.revision,epoch:s.epoch,participantId:nextDiscussionSpeaker(s).id,reply:reply(s),brain:{provider:'fixture',model:'actual'}};
 s=control(s,'intervene',{action:'evidence',text:'Which assumption is least supported?',characterId:s.participants[2].characterId});assert.equal(s.status,'paused');assert.equal(s.discussion.runningSince,null);assert.throws(()=>recordDiscussionTurn(s,pending),/another tab/);
 const target=s.participants[2].id;s=control(s,'resume');assert.equal(nextDiscussionSpeaker(s).id,target);s=turn(s,reply(s,'Demand is the weakest assumption.'));assert.equal(s.discussion.interventions[0].consumedBy,s.contributions.at(-1).id);
 const prior=s.characters[2];s=control(s,'pause');s=assignCharacter(s,{requestId:randomUUID(),expectedRevision:s.revision,characterId:prior.id,brain:{provider:'second',model:'another'},voice:prior.voice});assert.equal(s.participants[2].position,'Demand is the weakest assumption.');
});
test('committed turns replay once; duplicates, unknown references, repetition and terminal resumes are rejected',()=>{
 let s=control(readyDiscussion(),'start');const mutation={requestId:randomUUID(),expectedRevision:s.revision,epoch:s.epoch,participantId:nextDiscussionSpeaker(s).id,reply:reply(s),brain:{provider:'fixture',model:'actual'}};
 s=recordDiscussionTurn(s,mutation);assert.equal(recordDiscussionTurn(s,mutation),s);assert.throws(()=>turn(s,reply(s,'A distinct point.')),/repeats/);assert.throws(()=>turn(s,reply(s,'A new point.',{relatedIds:[randomUUID()]})),/unavailable/);
 s=control(s,'stop');assert.equal(s.outcomes[0].reportType,'partial');assert.match(s.outcomes[0].summary,/No final user decision/);assert.throws(()=>control(s,'resume'),/not active/);
});
test('the authoritative clock and turn budget survive pause, reload and completion',()=>{
 let s=readyDiscussion(),at='2026-10-26T12:00:00Z';s=control(s,'start',{now:at});assert.equal(elapsedDiscussion(s,Date.parse(at)+1500),1500);s=control(s,'pause',{now:'2026-10-26T12:00:02Z'});assert.equal(s.discussion.elapsedMs,2000);assert.equal(elapsedDiscussion(s,Date.parse(at)+100000),2000);
 s=control(s,'resume',{now:'2026-10-26T12:00:03Z'});s.discussion.elapsedMs=600001;assert.throws(()=>turn(s,reply(s)),/budget/);s=control(s,'finish');assert.equal(s.status,'completed');assert.equal(s.discussion.runningSince,null);
});
