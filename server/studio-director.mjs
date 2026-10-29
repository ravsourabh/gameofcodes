import {fields} from '../shared/studio/validation.mjs';
import {directorCapabilities,directionSchema,validateDirection} from '../shared/studio/orchestration.mjs';
import {activeTurns} from '../shared/studio/production.mjs';

// Planning is separate from execution: the browser and all other clients consume the same
// validated commands. No model response can run JavaScript, publish or call arbitrary APIs.
export function createStudioDirector({store,people,ai,receipt,advance,fail}){
  const inflight=new Map();
  async function plan(profileId,channelId,input,signal){
    const key=profileId+'/channels/'+channelId,signature=JSON.stringify(input),pending=inflight.get(key);
    if(pending){if(pending.signature===signature)return pending.promise;fail('The director is handling another instruction. Pause or wait.',409);}
    const work=(async()=>{
      const saved=await store.load(profileId,'channels',channelId);if(!saved)fail('Choose an owned channel.',404);
      const ack=receipt(saved,input,'direction');
      if(ack.replayed){const direction=saved.directionHistory?.find(item=>item.requestId===input.requestId);if(!direction)fail('That director receipt has expired. Use a new request.',409);return {channel:saved,direction,replayed:true};}
      if(typeof input.text!=='string'||!input.text.trim()||input.text.length>2000)fail('Use a direction of up to 2,000 characters.');
      const episode=input.episodeId?await store.load(profileId,'episodes',input.episodeId):null;
      if(input.episodeId&&(!episode||episode.deletedAt||episode.plan.channelId!==channelId))fail('Choose an episode in this channel.',404);
      if(episode&&(episode.revision!==input.episodeRevision||episode.epoch!==input.episodeEpoch))fail('The show changed. Refresh before directing it.',409,'REVISION_CONFLICT');
      if(input.playback){try{fields(input.playback,['playing','positionMs','screenPlaying'],'playback state');}catch(error){fail(error.message);}if(typeof input.playback.playing!=='boolean'||typeof input.playback.screenPlaying!=='boolean'||!Number.isSafeInteger(input.playback.positionMs)||input.playback.positionMs<0||input.playback.positionMs>7200000)fail('Use a bounded playback state.');}
      const library=await people.get(profileId),members=episode?.plan.cast||saved.definition.defaultCast||[];
      const brain=saved.definition.orchestrationBrain||saved.definition.writingBrain||library?.characters.find(actor=>actor.id===members.find(member=>member.slotId==='host')?.characterId)?.brain;if(!brain)fail('Choose a writer or director AI in Settings first.',409);
      const cast=members.map(member=>({id:member.characterId,name:library?.characters.find(actor=>actor.id===member.characterId)?.name||'Cast member',role:saved.definition.cast.find(slot=>slot.id===member.slotId)?.role||'Guest'}));
      const savedLines=episode?.production?activeTurns(episode.production):[];
      const context={adultComedy:saved.definition.adultComedy===true,savedLines:savedLines.map(turn=>({id:turn.id,characterId:turn.characterId,speaker:turn.characterSnapshot.name,text:turn.text,startMs:turn.startMs,durationMs:turn.durationMs||null})),capabilities:directorCapabilities(),instruction:input.text,premise:episode?.plan.premise||saved.setup?.notes.find(note=>note.id===saved.setup.currentNoteId)?.text||'',cast,state:{playback:input.playback||{playing:false,positionMs:0,screenPlaying:false},hasEpisode:!!episode,status:episode?.production?.status||'draft',phase:episode?.production?.phase||'draft',savedLines:episode?.production?activeTurns(episode.production).length:0,screen:!!saved.screen},recentLines:episode?.production?activeTurns(episode.production).slice(-3).map(turn=>({speaker:turn.characterSnapshot.name,text:turn.text})):[]};
      await ai.validateAssignment(brain,null);
      const result=await ai.directStudio(profileId,brain,context,directionSchema(cast.map(actor=>actor.id)),signal);
      let direction;try{direction=validateDirection(JSON.parse(result.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')),{characterIds:cast.map(actor=>actor.id),lineIds:savedLines.map(turn=>turn.id)});}catch(error){fail('The director returned an unsupported instruction: '+error.message,502);}
      if(signal?.aborted)fail('Direction interrupted. Saved work is kept.',409);
      return store.serial(key,async()=>{
        const fresh=await store.load(profileId,'channels',channelId);receipt(fresh,input,'direction');
        if(episode){const current=await store.load(profileId,'episodes',episode.id);if(current?.revision!==episode.revision||current?.epoch!==episode.epoch)fail('The show changed while the director was thinking. Saved work is kept.',409,'REVISION_CONFLICT');}
        if(signal?.aborted)fail('Direction interrupted. Saved work is kept.',409);
        const next=advance(fresh,input,'direction',ack.hash),entry={requestId:input.requestId,...direction,brain:result.brain,at:next.updatedAt};
        next.directionHistory=[...(next.directionHistory||[]),entry].slice(-20);await store.persist(next,'channels');
        return {channel:next,direction:entry,replayed:false};
      });
    })();
    inflight.set(key,{signature,promise:work});try{return await work;}finally{if(inflight.get(key)?.promise===work)inflight.delete(key);}
  }
  return {plan};
}
