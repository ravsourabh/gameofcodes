import {createHash,randomUUID} from 'node:crypto';
import {SessionError,updateRoster} from '../shared/session-domain.mjs';
import {generateCharacter,characterFields} from '../shared/character-domain.mjs';
import {controlDiscussion,nextDiscussionSpeaker,recordDiscussionTurn,elapsedDiscussion,activeParticipants} from '../shared/discussion-domain.mjs';
import {currentBrief,needsBrief,saveDiscussionBrief,saveCastPlan,completeCastPlan,scopeVersion} from '../shared/discussion-memory.mjs';
import {AVATAR_MODELS,modelForAppearance} from '../shared/avatar-catalog.mjs';
import {recordCutOff} from '../shared/room-performance.mjs';

export function discussionId(requestId,label){const bytes=createHash('sha256').update(requestId+'/'+label).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function createDiscussionService({ai,characters,load,persist,serial,inflight,json,fail}){
  const mutate=(s,requestId,fields={})=>({requestId,expectedRevision:s.revision,...fields});
  async function forCharacter(character,work){try{return await work();}catch(error){if(error instanceof SessionError&&error.code==='AI_MODEL_UNAVAILABLE'){error.message=`${character.name}: ${error.message}`;error.characterId=character.id;}throw error;}}
  async function applyBrief(profile,id,snapshot,controller,requestId,force=false){
    if(!needsBrief(snapshot)&&(!force||currentBrief(snapshot)))return snapshot;
    const guide=snapshot.guidance?.guide||snapshot.characters.find(c=>activeParticipants(snapshot).some(p=>p.characterId===c.id));
    if(!guide?.brain?.model)fail('Your correction is saved. Connect a guide brain before applying it.',409);
    const result=await forCharacter(guide,()=>ai.brief(profile,guide,snapshot,controller.signal));
    if(controller.signal.aborted)fail('Topic update interrupted. Your words are saved.',409);
    return serial(profile+'/'+id,async()=>{const s=await load(profile,id);if(controller.signal.aborted)fail('Topic update interrupted.',409);const next=saveDiscussionBrief(s,mutate(snapshot,requestId,result));await persist(next);return next;});
  }
  async function invite(profile,id,snapshot,controller,requestId){
    const key=profile+'/'+id;
    if(!snapshot.discussion){snapshot=await serial(key,async()=>{const s=await load(profile,id);const next=controlDiscussion(s,mutate(s,discussionId(requestId,'prepare'),{operation:'prepare'}));await persist(next);return next;});}
    if(snapshot.status!=='paused')fail('Pause before inviting other voices.',409);
    snapshot=await applyBrief(profile,id,snapshot,controller,discussionId(requestId,'brief'),true);
    let job=snapshot.discussion.castJobs?.find(j=>j.requestId===requestId);
    if(job?.status==='completed')return snapshot;
    if(job?.status==='cancelled'||job&&job.scopeVersion!==scopeVersion(snapshot))fail('The topic changed. Invite voices for the current brief again.',409,'STALE_CAST_PLAN');
    if(!job){job=snapshot.discussion.castJobs?.find(j=>j.status==='pending'&&j.scopeVersion===scopeVersion(snapshot));}
    if(!job){
      if(activeParticipants(snapshot).length>=2)return snapshot;
      const source=snapshot.characters.find(c=>c.id===activeParticipants(snapshot)[0]?.characterId)||snapshot.guidance.guide;
      if(!source.brain?.model)fail('Choose a brain for the current character before inviting voices.',409);
      const voice=source.voice||snapshot.guidance?.guide?.voice||null;await ai.validateAssignment(source.brain,voice);
      const names=new Set(snapshot.characters.map(c=>c.name.toLowerCase()));
      const usedModels=new Set([source,snapshot.guidance?.guide,...snapshot.characters.filter(c=>activeParticipants(snapshot).some(p=>p.characterId===c.id))].filter(Boolean).map(c=>modelForAppearance(c.avatar)));
      const items=currentBrief(snapshot).voices.slice(0,2).map((v,index)=>{
        const characterId=discussionId(requestId,'character-'+index),seed=Number.parseInt(characterId.replaceAll('-','').slice(0,8),16),base=generateCharacter(profile,{seed});
        let name=v.name;if(names.has(name.toLowerCase()))name=(name.slice(0,64)+' '+(index+2));names.add(name.toLowerCase());
        Object.assign(base,{name,personality:v.personality,code:v.code});
        if(usedModels.has(base.avatar.realistic.modelId))base.avatar.realistic.modelId=AVATAR_MODELS.find(m=>!usedModels.has(m.id))?.id||base.avatar.realistic.modelId;usedModels.add(base.avatar.realistic.modelId);
        return {id:characterId,createRequestId:discussionId(requestId,'library-'+index),role:v.role,fields:characterFields(Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(k=>[k,base[k]]))),brain:structuredClone(source.brain),voice:structuredClone(voice)};
      });
      if(controller.signal.aborted)fail('Invitation interrupted.',409);
      snapshot=await serial(key,async()=>{const s=await load(profile,id);const next=saveCastPlan(s,mutate(snapshot,requestId,{items}));await persist(next);return next;});job=snapshot.discussion.castJobs.at(-1);
    }
    for(const item of job.items){
      if(controller.signal.aborted)fail('Invitation paused. Resume the saved invitation to continue.',409);
      let library=await characters.get(profile);
      if(!library.characters.some(c=>c.id===item.id)){
        await ai.validateAssignment(item.brain,item.voice);
        library=(await characters.mutate(profile,{requestId:item.createRequestId,expectedRevision:library.revision,action:'create',id:item.id,character:item.fields,assignment:{brain:item.brain,voice:item.voice}})).library;
      }
    }
    if(controller.signal.aborted)fail('Invitation paused. Your saved invitation can be retried.',409);
    const library=await characters.get(profile);
    return serial(key,async()=>{
      let s=await load(profile,id);if(controller.signal.aborted||s.epoch!==snapshot.epoch||s.revision!==snapshot.revision)fail('The room changed before invitation finished. Retry from the saved state.',409);
      const entries=activeParticipants(s).map(p=>({characterId:p.characterId,role:p.role,code:p.code}));for(const i of job.items)if(!entries.some(e=>e.characterId===i.id))entries.push({characterId:i.id,role:i.role,code:i.fields.code});
      if(entries.length>5)fail('The room already has five active characters.',409);
      const rosterId=discussionId(job.requestId,'roster');if(!s.events.some(e=>e.requestId===rosterId)){s=updateRoster(s,mutate(s,rosterId,{entries}),library.characters);await persist(s);}
      const next=completeCastPlan(s,mutate(s,discussionId(job.requestId,'complete'),{jobId:job.requestId}));await persist(next);return next;
    });
  }
  return {async handle(req,res,{profileId,id,part,input,requestId}){
    const key=profileId+'/'+id;
    if(part==='performance')return serial(key,async()=>{const saved=await load(profileId,id);if(!saved)fail('Session not found.',404);const next=recordCutOff(saved,{...input,requestId});if(next!==saved)await persist(next);return json(res,200,{session:next,replayed:next===saved});});
    if(part==='control'){
      if(['pause','stop','finish','intervene'].includes(input.operation))inflight.get(key)?.abort();
      return serial(key,async()=>{const saved=await load(profileId,id);if(!saved)fail('Session not found.',404);const updated=controlDiscussion(saved,{...input,requestId});if(updated!==saved){if(['start','resume'].includes(input.operation))for(const p of activeParticipants(updated)){const c=updated.characters.find(c=>c.id===p.characterId);await forCharacter(c,()=>ai.validateAssignment(p.brain,c.voice));}await persist(updated);}return json(res,200,{session:updated,replayed:updated===saved});});
    }
    let snapshot=await serial(key,async()=>{const s=await load(profileId,id);if(!s)fail('Session not found.',404);return s;});
    const prior=snapshot.events.find(e=>e.requestId===requestId),pendingJob=snapshot.discussion?.castJobs?.find(j=>j.requestId===requestId&&j.status==='pending');
    if(part==='cast'&&snapshot.discussion?.castJobs?.some(j=>j.requestId===requestId&&j.status==='cancelled'))fail('The topic changed. Invite voices for the current brief again.',409,'STALE_CAST_PLAN');
    if(prior&&!pendingJob){
      const expected=part==='turn'?'session.discussion-turn':part==='brief'?'session.discussion-brief':'session.discussion-cast';if(prior.type!==expected)fail('Request identifier already used.',409);
      return json(res,200,{session:snapshot,...(part==='turn'?{contribution:snapshot.contributions.find(c=>c.requestId===requestId)}:{}),replayed:true});
    }
    const resumableCast=part==='cast'&&(snapshot.discussion?.castJobs?.some(j=>j.status==='pending')||snapshot.events.some(e=>e.requestId===discussionId(requestId,'prepare')));
    if(snapshot.revision!==input.expectedRevision&&!pendingJob&&!resumableCast)fail('The session changed. Reload before continuing.',409);
    if(part==='brief'&&!needsBrief(snapshot))return json(res,200,{session:snapshot,replayed:true});
    if(part==='turn'){
      if(snapshot.status!=='running'||!snapshot.discussion)fail('Resume the discussion before requesting a turn.',409);
      if(snapshot.discussion.turnsUsed>=snapshot.discussion.turnLimit||elapsedDiscussion(snapshot)>=snapshot.scenario.durationMinutes*60000){const updated=await serial(key,async()=>{const s=await load(profileId,id),next=controlDiscussion(s,mutate(s,randomUUID(),{operation:'pause'}));next.discussion.reason='The turn or duration budget is complete. Finish to keep a partial summary.';await persist(next);return next;});return json(res,429,{error:updated.discussion.reason,session:updated});}
    }
    if(inflight.has(key))fail('A character or topic update is already working. Pause or wait.',409);
    const controller=new AbortController(),disconnect=()=>{if(!res.writableEnded)controller.abort();};res.once('close',disconnect);inflight.set(key,controller);
    try{
      if(part==='cast'){const updated=await invite(profileId,id,snapshot,controller,requestId);return json(res,200,{session:updated});}
      snapshot=await applyBrief(profileId,id,snapshot,controller,part==='brief'?requestId:discussionId(requestId,'brief'));
      if(part==='brief')return json(res,200,{session:snapshot});
      const participant=nextDiscussionSpeaker(snapshot),character=snapshot.characters.find(c=>c.id===participant.characterId),result=await forCharacter(character,()=>ai.discussion(profileId,character,participant,snapshot,controller.signal));
      if(controller.signal.aborted)fail('Discussion interrupted.',409);
      const updated=await serial(key,async()=>{const s=await load(profileId,id),next=recordDiscussionTurn(s,mutate(snapshot,requestId,{epoch:snapshot.epoch,participantId:participant.id,...result}));await persist(next);return next;});
      return json(res,200,{session:updated,contribution:updated.contributions.find(c=>c.requestId===requestId)});
    }catch(error){
      await serial(key,async()=>{const s=await load(profileId,id);if(s?.status==='running'&&s.epoch===snapshot.epoch){const paused=controlDiscussion(s,mutate(s,randomUUID(),{operation:'pause'}));paused.discussion.reason=(error instanceof SessionError?error.message:'The provider connection was lost.').slice(0,300);await persist(paused);}});throw error;
    }finally{res.off('close',disconnect);if(inflight.get(key)===controller)inflight.delete(key);}
  }};
}
