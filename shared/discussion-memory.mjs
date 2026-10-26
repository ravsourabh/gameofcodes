import {SessionError,isId,prepareMutation,appendEvent} from './session-domain.mjs';

const check=(ok,message)=>{if(!ok)throw new SessionError(message,409,'DISCUSSION_MEMORY');};
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
export const normaliseTopic=t=>t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();
export const currentBrief=s=>s.discussion?.briefs?.at(-1)||null;
export const userDirections=s=>(s.discussion?.interventions||[]).filter(i=>i.action==='say');
export const scopeVersion=s=>currentBrief(s)?.scopeVersion||0;
export const currentScopeTurns=s=>(s.contributions||[]).filter(c=>c.discussion&&(c.scopeVersion||0)===scopeVersion(s));
export const needsBrief=s=>userDirections(s).some(i=>!currentBrief(s)?.sourceIds.includes(i.id));
const cleanPhrase=t=>t.trim().replace(/\s*(?:[,;]\s*)?(?:and )?nothing else[.!]?\s*$/i,'').replace(/^[\s“”"'‘’]+|[\s“”"'‘’.!?]+$/g,'').trim();
export const isScopeCorrection=t=>typeof t==='string'&&(/मेरा मतलब|मेरा आशय|सिर्फ|केवल|नज़रअंदाज़|भूल जाए|सुधार|विषय बदल/u.test(t)||/\b(?:(?:i|we)\s+(?:(?:only|just)\s+)?(?:mean|meant|intended)|ignore|forget|correction|focus on)\b/i.test(t));
export function explicitScope(s){
 let topic='';for(const i of userDirections(s)){
  const match=/(?:\b(?:i|we)\s+(?:(?:only|just)\s+)?(?:mean|meant|intend(?:ed)?)\s+|\b(?:i|we)\s+(?:only|just)\s+want(?:ed)?\s+|\b(?:focus|concentrate)(?: only)? on\s+|\bdiscuss (?:my|the) idea (?:of|about)\s+)([\s\S]+)/i.exec(i.text);
  if(match)topic=cleanPhrase(match[1]);else if(/मेरा मतलब|मेरा आशय|विषय बदल/u.test(i.text)||/\b(?:instead|new topic|change the (?:topic|idea)|switch (?:the|to)|let'?s (?:discuss|talk)|i now want)\b/i.test(i.text))topic='';
 }
 if(!topic)return null;
 const candidates=[...(currentBrief(s)?.excludedTopics||[])];
 for(const n of (s.guidance?.notes||[]).filter(n=>n.source==='user')){const match=/\b(?:my|the) idea (?:of|about)\s+(.+)/i.exec(n.text);if(match)candidates.push(cleanPhrase(match[1]));}
 for(const i of userDirections(s)){
  for(const match of i.text.matchAll(/[“"‘']([^”"’']{2,120})[”"’']\s*(?:[.,;:]\s*)?(?:ignore|forget|drop|no\b|is wrong)/gi))candidates.push(cleanPhrase(match[1]));
  for(const match of i.text.matchAll(/\b(?:ignore|forget|drop|exclude)\s+(.{2,120}?)(?=\s+(?:as well|and|but|instead)\b|[.!;]|$)/gi))candidates.push(cleanPhrase(match[1]));
 }
 const activeWords=new Set(normaliseTopic(topic).split(' ')),excludedTopics=[...new Map(candidates.filter(t=>t.length>=3&&t.length<=120&&!/^(?:that|this|it|everything)$/i.test(t)&&!normaliseTopic(t).split(' ').every(w=>activeWords.has(w))).map(t=>[normaliseTopic(t),t])).values()].slice(0,8);
 return {title:topic.length>120?topic.slice(0,117)+'…':topic,topic,goal:`Explore ${topic} through concrete benefits, risks, tradeoffs and a useful next step.`.slice(0,1200),excludedTopics};
}
export function groundBriefProposal(proposal,s){
 const scope=explicitScope(s);if(!scope)return proposal;
 return {...proposal,...scope,excludedTopics:[...new Map([...(proposal.excludedTopics||[]),...scope.excludedTopics].map(t=>[normaliseTopic(t),t])).values()]};
}
export function validateBriefProposal(p,s){
  check(p&&Object.keys(p).every(k=>['title','topic','goal','excludedTopics','assumptions','voices'].includes(k))&&text(p.title,120)&&text(p.topic,2000)&&text(p.goal,1200),'The corrected brief needs a short topic and goal.');
  const source=[s.scenario.situation,s.scenario.goal,...(s.guidance?.notes||[]).filter(n=>n.source==='user').map(n=>n.text),...userDirections(s).map(i=>i.text)].map(normaliseTopic).join(' ');
  check(Array.isArray(p.excludedTopics)&&p.excludedTopics.length<=8&&p.excludedTopics.every(t=>text(t,120)&&normaliseTopic(t).length>=3&&source.includes(normaliseTopic(t)))&&new Set(p.excludedTopics.map(normaliseTopic)).size===p.excludedTopics.length,'Retired topics must come from the user’s actual words.');
  const active=normaliseTopic(p.title+' '+p.topic+' '+p.goal);check(!p.excludedTopics.some(t=>active.includes(normaliseTopic(t))),'The brief cannot retire the topic the user just selected.');
  check(Array.isArray(p.assumptions)&&p.assumptions.length<=5&&p.assumptions.every(t=>text(t,300)),'Use short explicit assumptions.');
  check(Array.isArray(p.voices)&&p.voices.length>=2&&p.voices.length<=3&&p.voices.every(v=>v&&Object.keys(v).every(k=>['name','role','reason','code','personality'].includes(k))&&text(v.name,70)&&text(v.role,140)&&text(v.reason,300)&&text(v.code,300)&&text(v.personality,300)&&!/^(?:the )?(?:user|human user|you)(?:\s*\(|$)/i.test(v.name)),'Suggest distinct AI perspectives, not the human user as a character.');
  check(new Set(p.voices.map(v=>normaliseTopic(v.name))).size===p.voices.length,'Suggested characters need distinct names.');return p;
}
export function saveDiscussionBrief(session,mutation){
  const proposal=validateBriefProposal(groundBriefProposal(mutation.brief,session),session),command=JSON.stringify({action:'discussion-brief',brief:proposal,brain:mutation.brain}),next=prepareMutation(session,mutation,command);if(!next)return session;
  check(next.discussion&&['running','paused'].includes(next.status),'Update the topic during an active discussion.');
  const before=currentBrief(next),previous={topic:before?.topic||next.scenario.situation,goal:before?.goal||next.scenario.goal,excludedTopics:before?.excludedTopics||[]};
  const changed=normaliseTopic(previous.topic)!==normaliseTopic(proposal.topic)||normaliseTopic(previous.goal)!==normaliseTopic(proposal.goal)||JSON.stringify(previous.excludedTopics.map(normaliseTopic))!==JSON.stringify(proposal.excludedTopics.map(normaliseTopic));
  const record={id:crypto.randomUUID(),...structuredClone(proposal),scopeVersion:(before?.scopeVersion||0)+(changed?1:0),sourceIds:userDirections(next).map(i=>i.id),brain:structuredClone(mutation.brain),at:mutation.now||new Date().toISOString()};
  next.discussion.briefs||=[];check(next.discussion.briefs.length<45,'This discussion has reached its topic revision limit.');next.discussion.briefs.push(record);next.title=record.title;
  if(changed){next.participants.filter(p=>p.active).forEach(p=>p.position='');next.discussion.awaitingUser=null;next.discussion.proceedWithAssumptions=true;}
  next.epoch++;return appendEvent(next,'session.discussion-brief',mutation.requestId,command,record.at);
}
export function validateDiscussionMemory(s){
  const d=s.discussion;if(!d)return;
  if(d.style!==undefined)check(['group','coaching'].includes(d.style),'Invalid discussion style.');
  if(d.briefs!==undefined){check(Array.isArray(d.briefs)&&d.briefs.length<=45,'Invalid topic history.');for(const b of d.briefs){validateBriefProposal(Object.fromEntries(['title','topic','goal','excludedTopics','assumptions','voices'].map(k=>[k,b[k]])),s);check(isId(b.id)&&Number.isSafeInteger(b.scopeVersion)&&b.scopeVersion>=0&&Array.isArray(b.sourceIds)&&b.sourceIds.every(id=>userDirections(s).some(i=>i.id===id))&&b.brain&&text(b.brain.provider,80)&&text(b.brain.model,160)&&Number.isFinite(Date.parse(b.at)),'Invalid saved topic revision.');}}
  if(d.awaitingUser!==undefined&&d.awaitingUser!==null)check(isId(d.awaitingUser)&&s.contributions.some(c=>c.id===d.awaitingUser),'Invalid waiting question.');
  if(d.proceedWithAssumptions!==undefined)check(typeof d.proceedWithAssumptions==='boolean','Invalid clarification state.');
  if(d.castJobs!==undefined){check(Array.isArray(d.castJobs)&&d.castJobs.length<=10,'Invalid invitation history.');for(const j of d.castJobs)check(isId(j.requestId)&&['pending','completed','cancelled'].includes(j.status)&&Number.isSafeInteger(j.scopeVersion)&&Array.isArray(j.items)&&j.items.length>=1&&j.items.length<=2&&j.items.every(i=>isId(i.id)&&isId(i.createRequestId)&&text(i.role,160)&&i.fields&&i.brain?.model&&(i.voice===null||i.voice?.id)),'Invalid saved invitation.');}
}
export function saveCastPlan(session,mutation){
  const command=JSON.stringify({action:'discussion-cast-plan',items:mutation.items}),next=prepareMutation(session,mutation,command);if(!next)return session;
  check(next.discussion&&next.status==='paused','Pause before inviting characters.');next.discussion.castJobs||=[];check(next.discussion.castJobs.length<10,'This discussion has reached its invitation limit.');
  for(const j of next.discussion.castJobs)if(j.status==='pending')j.status='cancelled';
  next.discussion.castJobs.push({requestId:mutation.requestId,status:'pending',scopeVersion:scopeVersion(next),items:structuredClone(mutation.items)});next.epoch++;
  return appendEvent(next,'session.discussion-cast',mutation.requestId,command,mutation.now||new Date().toISOString());
}
export function completeCastPlan(session,mutation){
  const command=JSON.stringify({action:'discussion-cast-complete',jobId:mutation.jobId}),next=prepareMutation(session,mutation,command);if(!next)return session;
  const job=next.discussion?.castJobs?.find(j=>j.requestId===mutation.jobId);check(job?.status==='pending'&&job.items.every(i=>next.participants.some(p=>p.active&&p.characterId===i.id)),'The invited cast is not yet in the room.');job.status='completed';next.discussion.style='group';next.epoch++;
  return appendEvent(next,'session.discussion-cast',mutation.requestId,command,mutation.now||new Date().toISOString());
}
