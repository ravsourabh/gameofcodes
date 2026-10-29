import {editStudioScene,resolveStudioReviewer} from './studio-editor.mjs';
import {approvedSceneHistory} from '../shared/studio/story-history.mjs';
import {stagedDelivery,reactionVoicePack} from './studio-delivery.mjs';
import {SCENE_REVIEW_SCHEMA,validateSceneReview,sceneReviewPassed} from './studio-review.mjs';
import {motionDuration} from '../shared/studio/motion-library.mjs';
import {writtenPerformanceCues} from '../shared/studio/written-performance.mjs';
import {showOpening} from '../shared/studio/show.mjs';
import {stagingSchema,validateStaging,sparseStaging} from './studio-staging.mjs';
import {writerSchema,writerSceneBudget,validateWriterScene,normaliseWriterScene} from './studio-writer.mjs';
import {comicCharacterDetails,planBanter,applyBanter,banterDirection} from './studio-banter.mjs';
import {spokenCastRole} from './studio-writing.mjs';
import {createHash} from 'node:crypto';import {SessionError,isId} from '../shared/session-domain.mjs';
import {generateCharacter,characterFields} from '../shared/character-domain.mjs';import {starterProfile} from '../shared/studio/characters.mjs';
import {defaultStudioVoice} from '../shared/studio/voices.mjs';import {episodeInput,mediaKnowledge} from '../shared/studio/episodes.mjs';
import {getAction} from '../shared/studio/actions.mjs';
import {CORE_ACTIONS,validateCoreCues} from '../shared/studio/performance.mjs';import {MAX_WRITER_DIALOGUE_LINES,turnSchema,validateStudioReply,activeTurns} from '../shared/studio/production.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const derived=(requestId,label)=>{const bytes=createHash('sha256').update(requestId+'/'+label).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const raw=bytes.toString('hex');return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;};
const actorFields=actor=>characterFields(Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(key=>[key,actor[key]])));
// Space model-proposed reactions across the final recording. Director-authored cues keep their timing.
export function timeGeneratedCues(cues,turn,durationMs,staging=null){
  const generated=cues.filter(cue=>cue.triggerTurnId===turn.id&&cue.id===derived(turn.requestId,'cue/'+cues.filter(item=>item.triggerTurnId===turn.id).indexOf(cue)));
  generated.forEach((cue,index)=>{
    const peers=generated.filter(other=>other.characterId===cue.characterId&&getAction(cue.actionId).lanes.some(lane=>getAction(other.actionId).lanes.includes(lane))),lead=Math.min(550,durationMs*.12),slot=Math.max(1,(durationMs-lead-(peers.length-1)*150)/peers.length);
    const duration=Math.min(motionDuration(cue.actionId),peers.length>1?slot:durationMs),directed=staging?.reactionCharacterId===cue.characterId&&staging?.reactionActionId===cue.actionId;
    cue.atMs=Math.round(turn.startMs+(peers.length>1?lead+peers.indexOf(cue)*(slot+150):directed?durationMs*staging.atFraction:lead+index*300));
    cue.durationMs=Math.max(1,Math.floor(Math.min(duration,turn.startMs+durationMs-cue.atMs)));
  });
}
export function createStudioProduction({store,people,ai,speech,owned,plan,receipt,advance,first,fail,onError=()=>{}}){
  const inflight=new Map(),jobs=new Map();
  const key=(profileId,id)=>profileId+'/episodes/'+id;
  function presentAt(saved,beatId){return saved.plan.cast.filter(member=>{const guest=saved.plan.guestAppearances.find(guest=>guest.characterId===member.characterId);if(!guest)return true;const index=saved.plan.beats.findIndex(beat=>beat.id===beatId);return index>=saved.plan.beats.findIndex(beat=>beat.id===guest.enterAtBeatId)&&index<=saved.plan.beats.findIndex(beat=>beat.id===guest.leaveAfterBeatId);});}
  function attachWritten(record,written,requestId){const p=record.production,previous=p.schedule;p.writer=written;if(written.detourUsed===false)delete p.banter;else if(p.banter&&written.introductions?.length)p.banter.startIndex=Math.max(p.banter.startIndex,written.introductions.length);p.schedule=previous.slice(0,written.atTurn).concat(written.lines.map((line,index)=>({beatId:previous[written.atTurn+index]?.beatId||derived(requestId,'written/'+index),segment:written.atTurn+index===0?'setup':index===written.lines.length-1?'payoff':'panel',speakerId:line.characterId,source:'model'})));p.turnLimit=p.schedule.length;p.flow.minTurns=Math.min(p.flow.minTurns,p.schedule.length);p.flow.maxTurns=Math.max(p.flow.maxTurns,p.schedule.length);}
  function abort(profileId,id){for(const [jobId,job] of inflight)if(jobId.startsWith(key(profileId,id)+'/'))job.controller.abort();}
  function invalidate(record,reason='The draft changed.'){
    if(record.production){delete record.production.banter;delete record.production.flow;delete record.production.writer;delete record.production.editorial;record.production.status='paused';record.production.awaitingPlayback=null;record.production.cursor=0;record.production.schedule=[];record.production.positionMs=0;record.production.linePositionMs=0;record.production.reason=reason;}
  }
  async function bootstrap(profileId,id,input){return store.serial(profileId+'/channels/'+id,async()=>{
    const saved=await store.load(profileId,'channels',id);if(!saved)fail('Choose an owned channel.',404);
    const ack=receipt(saved,input,'produce'),episodeId=derived(input.requestId,'episode');
    if(ack.replayed){const episode=await store.load(profileId,'episodes',episodeId);if(!episode||episode.deletedAt)fail('The accepted episode receipt is incomplete. Saved characters are kept.',409);return {channel:saved,episode,library:await people.get(profileId),replayed:true};}
    const pool=await ai.catalog(),available=pool.providers.filter(provider=>provider.models.length);
    if(!available.length)fail('Connect a reasoning model before asking the cast to collaborate.',503,'MODEL_UNAVAILABLE');
    let library=await people.get(profileId);const entries=[...(saved.definition.defaultCast||[])],slots=saved.definition.cast.filter(slot=>slot.membership!=='guest');
    const empty=entries.length===0,chosen=slots.filter(slot=>empty||!slot.optional||entries.some(member=>member.slotId===slot.id));
    for(const [index,slot] of chosen.entries()){
      let member=entries.find(member=>member.slotId===slot.id),actor=library?.characters.find(actor=>actor.id===member?.characterId);
      if(!actor){
        const actorId=derived(input.requestId,'actor/'+slot.id);actor=library?.characters.find(actor=>actor.id===actorId);
        if(!actor){
          const seed=(parseInt(hash(input.requestId).slice(0,7),16)+index)>>>0,generated=generateCharacter(profileId,{seed,id:actorId}),provider=available[index%available.length];generated.name=['Raghu','Nisha','Kabir'][index]||generated.name;if(index===0)generated.voicePreference={style:'resonant',pace:'relaxed'};
          const result=await people.mutate(profileId,{requestId:derived(input.requestId,'accept/'+slot.id),expectedRevision:library?.revision||0,action:'create',id:actorId,character:actorFields(generated),profile:starterProfile(generated),assignment:{brain:{provider:provider.id,model:provider.models[0].id},voice:defaultStudioVoice(saved.definition.language.primary,index)},channelId:id});library=result.library;actor=library.characters.find(actor=>actor.id===actorId);
        }
        member={slotId:slot.id,characterId:actorId};entries.push(member);
      }
      if(!actor.brain||!actor.voice){
        const provider=available[index%available.length];const result=await people.mutate(profileId,{requestId:derived(input.requestId,'preferences/'+slot.id),expectedRevision:library.revision,action:'update',id:actor.id,character:actorFields(actor),profile:actor.studioProfile||starterProfile(actor,{legacy:true}),assignment:{brain:actor.brain||{provider:provider.id,model:provider.models[0].id},voice:actor.voice||defaultStudioVoice(saved.definition.language.primary,index)}});library=result.library;
      }
    }
    const next=advance(saved,input,'produce',ack.hash,true);next.definition.defaultCast=entries;
    const current=next.setup?.notes.find(note=>note.id===next.setup.currentNoteId);
    const premise=input.premise?.trim()||current?.text||'A very serious fictional newsroom investigates why cancelling an unnecessary meeting requires another meeting.';
    if(input.premise||!current){next.setup||={schemaVersion:1,notes:[],currentNoteId:null};if(next.setup.notes.length>=50)fail('This channel has reached its premise limit.',413);const noteId=derived(input.requestId,'premise');next.setup.notes.push({id:noteId,text:premise,source:input.premise?(input.source||'written'):'delegated',status:'confirmed',at:next.updatedAt,...(next.setup.currentNoteId?{supersedes:next.setup.currentNoteId}:{})});next.setup.currentNoteId=noteId;}else current.status='confirmed';
    let episode=await store.load(profileId,'episodes',episodeId);
    if(!episode){episode={...first(profileId,episodeId,'studio-episode',input,ack.hash,'produce'),plan:plan({id:episodeId,premise,writingMode:'improvised',cast:entries},next.definition,library),channelRevision:next.revision,status:'draft',takes:[],humanInputs:[]};await store.persist(episode,'episodes');}
    // The episode goes first: if channel acceptance fails, its deterministic ID
    // and saved identities let the same request resume without paying/creating again.
    await store.persist(next,'channels');return {channel:next,episode,library,replayed:false};
  });}
  function schedule(saved,mode,limit,requestId){
    if(saved.plan.beats.length)return saved.plan.beats.map(beat=>({beatId:beat.id,segment:beat.segment,speakerId:beat.speakerId||saved.plan.cast[0].characterId,source:beat.kind==='human-input'?'human':beat.kind==='media'?'media':beat.kind==='action'?'action':mode==='scripted'||beat.locked||beat.text&&beat.origin!=='generated'?'authored':'model',...(beat.text?{text:beat.text}:{})}));
    if(mode==='scripted')fail('Scripted mode needs authored lines. Cast-led mode needs only a premise.',400);
    const regular=saved.plan.cast.filter(member=>!saved.plan.guestAppearances.some(guest=>guest.characterId===member.characterId)).sort((a,b)=>Number(b.slotId==='host')-Number(a.slotId==='host'));
    return Array.from({length:limit},(_,index)=>({beatId:derived(requestId,'beat/'+index),segment:index===0?'setup':index===limit-1?'payoff':'panel',speakerId:regular[index===limit-1&&limit>regular.length?0:index%regular.length].characterId,source:'model'}));
  }
  async function control(profileId,id,input){return store.serial(key(profileId,id),async()=>{
    const saved=await store.load(profileId,'episodes',id);if(!saved||saved.deletedAt)fail('Choose an owned episode.',404);const operation=input.operation,ack=receipt(saved,input,'production.'+operation);if(ack.replayed)return {episode:saved,replayed:true};
    const next=advance(saved,input,'production.'+operation,ack.hash,['start','pause','stop','resume','continue','prepare-voices','edit-line','regenerate'].includes(operation));
    if(operation==='start'){
      if(saved.status==='cancelled')fail('Revise the cancelled draft before starting.',409);
      const mode=input.mode||saved.plan.writingMode,adaptive=input.adaptive===true&&input.turnLimit===undefined&&!saved.plan.beats.length&&mode!=='scripted',limit=input.turnLimit||(adaptive&&typeof ai.writeStudio==='function'?MAX_WRITER_DIALOGUE_LINES:adaptive?12:6);if(!['scripted','hybrid','improvised'].includes(mode)||!Number.isInteger(limit)||limit<2||limit>(adaptive?MAX_WRITER_DIALOGUE_LINES:12))fail('Choose a bounded writing mode and 2–12 contributions.',400);
      const banter=planBanter({runId:input.requestId,cast:saved.plan.cast.filter(member=>!saved.plan.guestAppearances.some(guest=>guest.characterId===member.characterId)),turnCount:limit,format:saved.plan.formatId,mode,hasBeats:!!saved.plan.beats.length}),beats=applyBanter(schedule(saved,mode,limit,input.requestId),banter),actors=await owned(profileId,saved.plan.cast);
      const planningChannel=adaptive&&typeof ai.writeStudio==='function'?await store.load(profileId,'channels',saved.plan.channelId):null;
      for(const member of saved.plan.cast){const actor=actors.characters.find(actor=>actor.id===member.characterId);if(adaptive&&typeof ai.writeStudio==='function'){if(member.slotId==='host')await ai.validateAssignment(planningChannel?.definition.writingBrain||actor.brain,null);continue;}if(beats.some(beat=>beat.source==='model'&&beat.speakerId===actor.id))await ai.validateAssignment(actor.brain,null);}
      abort(profileId,id);next.production={schemaVersion:1,...(banter?{banter}:{}),...(adaptive?{flow:{schemaVersion:1,minTurns:Math.max(4,banter?banter.startIndex+4:4),maxTurns:limit,pendingQuestionTo:null}}:{}),castIds:[...new Set([...(saved.production?.castIds||[]),...saved.plan.cast.map(member=>member.characterId)])],phase:input.prepareOnly?'composing':'live',status:'running',mode,runId:input.requestId,turnLimit:Math.min(12,beats.length),cursor:0,schedule:beats,turns:saved.production?.turns||[],awaitingPlayback:null,positionMs:0,linePositionMs:0,cues:saved.production?.cues||[],edits:saved.production?.edits||[],reason:''};
      if(next.production.turns.length>=108)fail('This episode has reached its saved performance limit. Start a new episode.',413);
    }else{
      if(!next.production&&operation==='edit-line')next.production={schemaVersion:1,status:'paused',mode:'hybrid',runId:input.requestId,turnLimit:6,cursor:0,schedule:[],turns:[],awaitingPlayback:null,positionMs:0,linePositionMs:0,cues:[],edits:[],reason:''};
      const p=next.production;if(!p)fail('Start this episode first.',409);
      if(['pause','stop'].includes(operation)){abort(profileId,id);p.status='paused';p.reason=operation==='stop'?'Stopped by the director.':'Paused by the director.';if(Number.isFinite(input.positionMs))p.linePositionMs=Math.max(0,Math.min(180000,input.positionMs));}
      else if(operation==='resume'){if(p.status==='completed')fail('This run is complete. Replay it or start a new version.',409);if(!p.schedule.length)fail('The draft changed. Start a new version so every actor receives the correction.',409);p.status='running';p.reason='';}
      else if(operation==='continue'){
        if(p.status!=='completed'||p.mode==='scripted'||p.schedule.some(beat=>!['model','authored'].includes(beat.source)))fail('Finish this cast-led segment before continuing it.',409);
        const written=typeof ai.writeStudio==='function';
        const closings=new Set(activeTurns(p).filter(turn=>turn.intent==='closing').map(turn=>turn.beatId));
        const retained=p.schedule.slice(0,p.cursor).filter(beat=>!closings.has(beat.beatId)),from=retained.length,extension=written?Math.min(MAX_WRITER_DIALOGUE_LINES,100-from,108-p.turns.length):6;
        if(extension<4||from+extension>100||p.turns.length+extension>108)fail('This episode is full. Prepare a new version to keep talking.',413);
        const cast=saved.plan.cast.filter(member=>!saved.plan.guestAppearances.some(guest=>guest.characterId===member.characterId)).sort((a,b)=>Number(b.slotId==='host')-Number(a.slotId==='host'));
        const pending=p.flow?.pendingQuestionTo||null;
        p.schedule=retained.concat(Array.from({length:extension},(_,index)=>({beatId:derived(input.requestId,'continue/'+index),segment:index===extension-1?'payoff':'panel',speakerId:index===0&&pending?pending:cast[index===extension-1?0:(from+index)%cast.length].characterId,source:'model'})));
        next.plan.beats=next.plan.beats.filter(beat=>!closings.has(beat.id));
        p.cursor=from;let position=0;for(const line of activeTurns(p)){const shift=position-line.startMs;line.startMs=position;for(const cue of p.cues.filter(cue=>cue.triggerTurnId===line.id))cue.atMs=Math.max(position,Math.round(cue.atMs+shift));position+=Math.ceil(line.durationMs||Math.max(1200,line.text.length*42));}p.positionMs=position;p.linePositionMs=0;
        p.cues=p.cues.filter(cue=>!p.turns.some(turn=>closings.has(turn.beatId)&&cue.triggerTurnId===turn.id));
        delete p.writer;delete p.editorial;delete p.banter;p.flow={schemaVersion:1,minTurns:from+(written?6:3),maxTurns:from+extension,pendingQuestionTo:pending};p.turnLimit=from+extension;p.phase='composing';p.status='running';p.awaitingPlayback=null;p.reason='Expanding before the ending. Earlier conversation and voices are kept; the host will close after the new material.';
      }
      else if(operation==='prepare-voices'){
        if(!p.schedule.length||p.cursor<p.schedule.length||!activeTurns(p).length)fail('Finish the saved dialogue before preparing its voices.',409);
        abort(profileId,id);p.phase='voicing';p.status='running';p.reason='Preparing voices for the saved dialogue. No new lines will be generated.';
      }else if(operation==='ready'){
        const turns=activeTurns(p);if(p.phase!=='voicing'||!turns.length||turns.some(turn=>!turn.voiceAssetId)&&input.captions!==true)fail('Finish final audio preparation or deliberately choose captions.',409);p.phase='ready';p.status='completed';p.reason=p.flow?'Conversation ready. Play it or continue the conversation.':'Prepared show ready. Review the lines or play the saved performance.';
      }else if(operation==='drafted'||operation==='played'){
        if(operation==='drafted'&&p.phase!=='composing')fail('Draft advancement belongs to the conversation layer.',409);
        const turn=p.turns.find(turn=>turn.id===input.turnId);if(!turn||p.awaitingPlayback!==turn.id)fail('Acknowledge the current actual line.',409);
        let duration;if(turn.voiceAssetId){const asset=await speech.get(profileId,turn.voiceAssetId);duration=asset.durationMs;}else if(input.captions===true||operation==='drafted')duration=Math.min(15000,Math.max(1200,turn.text.length*42));else fail('Prepare speech or explicitly choose captions.',409);
        p.positionMs=Math.round(Math.max(p.positionMs,turn.startMs+duration));p.linePositionMs=0;p.awaitingPlayback=null;turn.durationMs=duration;
        if(p.cursor>=p.schedule.length||activeTurns(p).length>=p.turnLimit){if(p.phase==='composing'){p.phase='voicing';p.reason='Conversation saved. Preparing voices.';}else{p.status='completed';p.reason='The bounded show is complete.';}}
      }else if(operation==='edit-line'){
        const beat=saved.plan.beats.find(beat=>beat.id===input.beatId);if(typeof input.text!=='string'||!input.text.trim()||input.text.length>2500||!saved.plan.cast.some(member=>member.characterId===input.characterId))fail('Choose an actor and a bounded authored line.',400);
        const item={schemaVersion:1,id:input.beatId,segment:input.segment||beat?.segment||'panel',kind:'speech',speakerId:input.characterId,text:input.text,origin:'authored',locked:input.locked!==false};
        const raw=episodeInput(saved.plan);raw.beats=beat?raw.beats.map(previous=>previous.id===beat.id?item:previous):[...raw.beats,item];const actors=await owned(profileId,saved.plan.cast);next.plan=plan(raw,saved.plan.channelSnapshot,actors);
        p.edits.push({beatId:item.id,before:beat?.text||'',after:input.text,at:next.updatedAt});if(p.editorial)p.editorial.status='outdated';abort(profileId,id);
        const original=activeTurns(p).find(turn=>turn.beatId===item.id);
        if(original){
          const actor=actors.characters.find(actor=>actor.id===input.characterId),turn={...structuredClone(original),id:derived(input.requestId,'edited-line'),requestId:input.requestId,characterId:actor.id,text:input.text,source:'authored',brain:null,epoch:next.epoch,at:next.updatedAt,characterSnapshot:structuredClone(actor)};delete turn.voiceAssetId;delete turn.durationMs;
          p.turns.push(turn);p.status='paused';p.phase='voicing';p.awaitingPlayback=null;p.reason='One line changed. Prepare its new voice; other lines and recordings are kept.';
          p.schedule=p.schedule.map(beat=>beat.beatId===item.id?{...beat,speakerId:actor.id,text:input.text,source:'authored'}:beat);
        }else invalidate(next,'The authored rundown changed. Start the revised version.');
      }else if(operation==='camera-cue'){
        const turn=activeTurns(p).find(turn=>turn.id===input.turnId);if(!turn)fail('Choose a current saved line for the camera.',400);
        if(!['auto','wide','host','speaker','two-person','reaction','close-up','screen'].includes(input.shot)||input.characterId!=null&&!saved.plan.cast.some(member=>member.characterId===input.characterId)||!Number.isFinite(input.atFraction)||input.atFraction<0||input.atFraction>.95)fail('Choose a supported shot, actor and bounded line timing.',400);
        p.cameraCues||=[];if(p.cameraCues.length>=80)fail('This episode has reached its saved camera direction limit.',413);
        p.cameraCues.push({id:input.requestId,runId:p.runId,turnId:turn.id,shot:input.shot,characterId:input.characterId||null,atFraction:input.atFraction});
      }else if(operation==='cue'){
        const trigger=p.turns.find(turn=>turn.id===input.turnId);if(!trigger)fail('Direct a reaction to an actual saved line.',400);
        if(trigger.runId!==p.runId||!activeTurns(p).some(turn=>turn.id===trigger.id))fail('Choose the current version of this performance line.',409);
        const cue={schemaVersion:1,id:input.requestId,characterId:input.characterId,actionId:input.actionId,atMs:Math.max(trigger.startMs,input.atMs??trigger.startMs),durationMs:input.durationMs||motionDuration(input.actionId),intensity:input.intensity??.6,...(input.targetId?{targetId:input.targetId}:{})};
        if(trigger.durationMs){const end=trigger.startMs+trigger.durationMs;if(cue.atMs>=end)fail('Choose a reaction time within this saved line.',400);cue.durationMs=Math.min(cue.durationMs,end-cue.atMs);}
        if(trigger.characterId===cue.characterId&&['props.drink-water','fatigue.sleep-on-desk','fatigue.yawn'].includes(cue.actionId))fail('Choose a listening character or a silent beat for this motion; the speaker is delivering this line.',400);
        const previousCues=p.cues;
        // A fresh director choice replaces overlapping motions on the same actor and lane for this line.
        // Other actors, other lines and immutable takes keep their original reactions.
        if(CORE_ACTIONS.includes(cue.actionId))p.cues=p.cues.filter(existing=>!(existing.runId===p.runId&&existing.triggerTurnId===trigger.id&&existing.characterId===cue.characterId&&existing.atMs<cue.atMs+cue.durationMs&&cue.atMs<existing.atMs+existing.durationMs&&getAction(existing.actionId).lanes.some(lane=>getAction(cue.actionId).lanes.includes(lane))));
        try{validateCoreCues([cue],{characterIds:presentAt(saved,trigger.beatId).map(member=>member.characterId),targetIds:['desk','chair','microphone','notes','pen','cup','laptop','watch','main-screen']});validateCoreCues([...p.cues.filter(cue=>cue.runId===p.runId&&activeTurns(p).some(turn=>turn.id===cue.triggerTurnId)).map(({triggerTurnId,runId,...cue})=>cue),cue],{characterIds:saved.plan.cast.map(member=>member.characterId),targetIds:['desk','chair','microphone','notes','pen','cup','laptop','watch','main-screen']});}catch(error){p.cues=previousCues;fail(error.message.startsWith('Conflicting performance lanes')?'This reaction overlaps another saved line. Choose a reaction within this line or a different character.':error.message,400);}
        p.cues.push({...cue,triggerTurnId:trigger.id,runId:p.runId});
      }else if(operation==='regenerate'){
        const index=p.schedule.findIndex(beat=>beat.beatId===input.beatId);if(index<0||p.schedule[index].source!=='model')fail('Select an unlocked collaboration line to regenerate.',400);abort(profileId,id);delete p.flow;delete p.writer;delete p.editorial;p.cursor=index;p.awaitingPlayback=null;p.status='running';p.phase='composing';p.turnLimit=Math.min(12,p.turnLimit+1);p.reason='One line selected for a new contribution.';
      }else fail('Unsupported production control.',400);
    }
    await store.persist(next,'episodes');return {episode:next,replayed:false};
  });}
  async function turn(profileId,id,input,signal){
    const jobKey=key(profileId,id)+'/turn',current=inflight.get(jobKey);if(current){if(current.requestId===input.requestId)return current.promise;fail('One actor is preparing a contribution. Pause or wait.',409);}
    let started=false;const controller=new AbortController();const disconnect=()=>controller.abort();signal?.addEventListener('abort',disconnect,{once:true});
    const work=(async()=>{
      const snapshot=await store.serial(key(profileId,id),async()=>{const saved=await store.load(profileId,'episodes',id);if(!saved||saved.deletedAt)fail('Choose an owned episode.',404);const ack=receipt(saved,input,'production.turn');return {saved,ack};});
      const {saved,ack}=snapshot;if(ack.replayed)return {episode:saved,replayed:true};const p=saved.production;
      if(!p||p.status!=='running'||p.awaitingPlayback||p.cursor>=p.schedule.length)fail('Resume the show, or finish its pending line, before another actor speaks.',409);
      if(activeTurns(p).length>=p.turnLimit)fail('This show has reached its contribution budget.',409);
      const beat=p.schedule[p.cursor];if(beat.source==='human')fail('Wait for the real participant answer; the cast will not invent it.',409,'WAITING_FOR_HUMAN');
      if(['media','action'].includes(beat.source))fail('This rundown beat needs an explicit media/action step before speech continues.',409,'WAITING_FOR_STAGE');
      started=true;const present=presentAt(saved,beat.beatId);
      const library=await owned(profileId,saved.plan.cast);let actor=library.characters.find(actor=>actor.id===beat.speakerId);const scope=hash(saved.plan.premise),history=activeTurns(p).filter(turn=>turn.scope===scope&&p.schedule.slice(0,p.cursor).some(beat=>beat.beatId===turn.beatId)).slice(-10),last=history.at(-1)||null;
      let text=beat.text,brain=null,reply={cues:[]},pendingWriter=null;
      if(beat.source==='model'){
        const contexts=await Promise.all(present.map(member=>people.context(profileId,{observerId:actor.id,subjectId:member.characterId,channelId:saved.plan.channelId})));
        const opening=p.cursor===0&&beat.segment==='setup'?{
          style:'original Hindi television breaking-news satire, grave headline delivery, crisp punchy pacing',
          variant:['headline-first','formal-greeting','urgent-bulletin','dramatic-question','deadpan-alert','straight-to-the-desk'][parseInt(hash(p.runId).slice(0,8),16)%6],
          host:{id:actor.id,name:actor.name},
          panel:present.filter(member=>member.characterId!==actor.id).map(member=>({id:member.characterId,name:library.characters.find(person=>person.id===member.characterId)?.name,role:spokenCastRole(saved.plan.channelSnapshot.cast.find(slot=>slot.id===member.slotId),saved.plan.language.primary)})),
          previousOpenings:p.turns.filter(turn=>turn.segment==='setup'&&turn.characterId===actor.id).slice(-3).map(turn=>turn.text),
        }:null;
        const comedy=['deadpan-meme','funny-news'].includes(saved.plan.formatId);
        const following=p.cursor+1,reserved=p.banter&&following>=p.banter.startIndex&&following<=p.banter.startIndex+2,flow=p.flow?{minimumReached:p.cursor+1>=p.flow.minTurns,turnsRemaining:p.flow.maxTurns-p.cursor,answerExpected:p.flow.pendingQuestionTo===actor.id,allowedNextSpeakerIds:reserved?[p.schedule[following].speakerId]:present.filter(member=>member.characterId!==actor.id).map(member=>member.characterId)}:null;
        const audienceChannel=await store.load(profileId,'channels',saved.plan.channelId);
        const context={adultComedy:audienceChannel?.definition.adultComedy??saved.plan.channelSnapshot.adultComedy??false,show:{name:'बात का बवाल',tagline:'मुद्दा छोटा, बवाल बड़ा।'},flow,comicCharacter:comedy?{origin:'optional generated fictional colour',...comicCharacterDetails(actor.id)}:null,conversationDetour:comedy?banterDirection(p,actor.id,history):null,nextSpeakerId:p.schedule[p.cursor+1]?.speakerId||null,turnIndex:p.cursor,turnCount:p.schedule.length,yourSlotId:saved.plan.cast.find(member=>member.characterId===actor.id).slotId,opening,premise:saved.plan.premise,language:saved.plan.language,spokenLanguage:saved.plan.language.primary==='hi-IN'?'देवनागरी हिन्दी में बोलें। अंग्रेज़ी तकनीकी शब्द ही Latin में रखें। Roman Hindi नहीं।':'English',segment:beat.segment,final:beat.segment==='payoff',yourCharacterId:actor.id,yourRole:spokenCastRole(saved.plan.channelSnapshot.cast.find(slot=>slot.id===saved.plan.cast.find(member=>member.characterId===actor.id).slotId),saved.plan.language.primary),voiceDirection:saved.plan.channelSnapshot.voiceDirection,format:saved.plan.formatId,characters:contexts,cast:present,history:history.map(({id,characterId,text,segment})=>({id,characterId,text,segment})),latestContribution:last?{id:last.id,characterId:last.characterId,text:last.text}:null,media:saved.plan.media.map(mediaKnowledge),readyActions:CORE_ACTIONS};
        if(p.flow&&typeof ai.writeStudio==='function'){
          let written=p.writer;
          if(!written||p.cursor<written.atTurn||p.cursor>=written.atTurn+written.lines.length){
            const host=library.characters.find(person=>person.id===saved.plan.cast.find(member=>member.slotId==='host')?.characterId),currentChannel=await store.load(profileId,'channels',saved.plan.channelId),writerBrain=currentChannel?(currentChannel.definition.writingBrain||host?.brain):(saved.plan.channelSnapshot.writingBrain||host?.brain);
            const packets=await Promise.all(present.map(async member=>{const person=library.characters.find(person=>person.id===member.characterId),{canon,...profile}=person.studioProfile||{};return {id:person.id,name:person.name,slotId:member.slotId,personality:person.personality,code:person.code,profile,comicColour:comicCharacterDetails(person.id),knownFactsByCharacter:await Promise.all(present.map(async subject=>{const known=await people.context(profileId,{observerId:person.id,subjectId:subject.characterId,channelId:saved.plan.channelId});return {characterId:subject.characterId,facts:known.canon};}))};}));
            const recentScenes=approvedSceneHistory((await store.list(profileId,'episodes')).records,{episodeId:saved.id,channelId:saved.plan.channelId,characterIds:present.map(member=>member.characterId)});
            const initial=p.cursor===0,budget=writerSceneBudget({cast:present,initial,maxDialogueLines:initial?MAX_WRITER_DIALOGUE_LINES:p.flow.maxTurns-p.cursor,minDialogueLines:initial?Math.max(4,present.length):4}),{minLines,maxLines}=budget,firstSpeakerId=initial?actor.id:p.flow.pendingQuestionTo||null,writerInput={adultComedy:context.adultComedy,hostId:host.id,requireClosing:true,writerNotes:currentChannel?.definition.writerNotes??saved.plan.channelSnapshot.writerNotes??'',premise:saved.plan.premise,format:saved.plan.formatId,language:saved.plan.language,firstSpeakerId,cast:present,characters:packets,opening,recentScenes,history:activeTurns(p).map(({id,characterId,text,intent,segment})=>({id,characterId,text,intent,segment})),latestContribution:context.latestContribution,conversationDetour:initial&&p.banter?{...p.banter,startIndex:Math.max(present.length,p.banter.startIndex)}:null,...budget,media:context.media,readyActions:CORE_ACTIONS};
            const job=inflight.get(jobKey);if(job)job.phase='writing';
            if(typeof ai.reviewStudio==='function'){
              const reviewerBrain=await resolveStudioReviewer(ai,writerBrain,currentChannel?currentChannel.definition.reviewingBrain:saved.plan.channelSnapshot.reviewingBrain);
              const edited=await editStudioScene({ai,profileId,writerBrain,reviewerBrain,input:{...writerInput,atTurn:p.cursor,runId:p.runId},budget,cast:present,initial,hostId:host.id,signal:controller.signal,previous:p.editorial,onPhase:phase=>{if(job)job.phase=phase;},onCheckpoint:journal=>store.serial(key(profileId,id),async()=>{
                const latest=await store.load(profileId,'episodes',id);if(controller.signal.aborted||latest.epoch!==saved.epoch||latest.production.cursor!==p.cursor)fail('A newer direction replaced the editorial draft.',409,'STALE_RESULT');
                const checkpoint={requestId:derived(input.requestId,'editorial/'+latest.revision),expectedRevision:latest.revision,expectedEpoch:latest.epoch},accepted=receipt(latest,checkpoint,'production.editorial'),next=advance(latest,checkpoint,'production.editorial',accepted.hash);next.production.editorial=journal;await store.persist(next,'episodes');
              })});written={schemaVersion:1,brain:edited.brain,atTurn:p.cursor,...edited.scene};
            }else{
            for(let attempt=0;attempt<2;attempt++){
              let sceneForRepair=null;
              const result=await ai.writeStudio(profileId,writerBrain,writerInput,writerSchema(present,budget),controller.signal);if(controller.signal.aborted)fail('Scene writing interrupted.',409,'INTERRUPTED');
              try{const scene=normaliseWriterScene(JSON.parse(result.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')),{cast:present,initial,hostId:host.id,characters:packets,language:saved.plan.language});sceneForRepair=scene;validateWriterScene(scene,{cast:present,firstSpeakerId,maxLines:initial&&scene.introductions===undefined?budget.dialogueMaxLines:maxLines,minLines:initial&&scene.introductions===undefined?budget.dialogueMinLines:minLines,initial,banter:initial?p.banter:null,history:writerInput.history,requireClosing:true,hostId:host.id});if(typeof ai.reviewStudio==='function'){const checked=await ai.reviewStudio(profileId,writerBrain,{...writerInput,proposedScene:scene},SCENE_REVIEW_SCHEMA,controller.signal);const review=validateSceneReview(JSON.parse(checked.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')));if(!sceneReviewPassed(review))throw new Error('Scene editor: '+review.reason);}written={schemaVersion:1,brain:result.brain,atTurn:p.cursor,...scene};break;}catch(error){if(attempt)fail('The scene writer could not produce a consistent scene: '+error.message,502,'INVALID_SCENE');writerInput.recovery=error.message;if(sceneForRepair)writerInput.revisionDraft=sceneForRepair.introductions?{...sceneForRepair,lines:sceneForRepair.lines.slice(sceneForRepair.introductions.length)}:sceneForRepair;}
            }
            }
            await store.serial(key(profileId,id),async()=>{const latest=await store.load(profileId,'episodes',id);if(controller.signal.aborted||latest.epoch!==saved.epoch||latest.production.cursor!==p.cursor)fail('A newer direction replaced the written scene.',409,'STALE_RESULT');const checkpoint={requestId:derived(input.requestId,'writer-plan'),expectedRevision:latest.revision,expectedEpoch:latest.epoch},accepted=receipt(latest,checkpoint,'production.writer-plan'),next=advance(latest,checkpoint,'production.writer-plan',accepted.hash);attachWritten(next,written,input.requestId);await store.persist(next,'episodes');});
          }
          if(written.atTurn===0&&p.cursor===0){const openingText=showOpening(written.lines[0].text);if(openingText!==written.lines[0].text){written={...written,lines:written.lines.map((line,index)=>index===0?{...line,text:openingText}:line)};pendingWriter=written;}}
          // Upgrade an unfinished cached scene without rewriting or paying for its dialogue again.
          if(!written.lines.some(line=>line.intent==='closing')&&written.lines.length<12){
            const host=library.characters.find(person=>person.id===saved.plan.cast.find(member=>member.slotId==='host')?.characterId),{canon,...profile}=host.studioProfile||{},closingInput={adultComedy:context.adultComedy,closingOnly:true,hostId:host.id,firstSpeakerId:host.id,cast:present,characters:[{id:host.id,name:host.name,personality:host.personality,code:host.code,profile}],premise:saved.plan.premise,language:saved.plan.language,history:written.lines,minLines:1,maxLines:1};
            const result=await ai.writeStudio(profileId,written.brain,closingInput,writerSchema(present),controller.signal);if(controller.signal.aborted)fail('Closing interrupted. Saved dialogue is kept.',409,'INTERRUPTED');let closing;
            try{closing=normaliseWriterScene(JSON.parse(result.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')),{cast:present});validateWriterScene(closing,{cast:present,firstSpeakerId:host.id,hostId:host.id,minLines:1,maxLines:1,initial:false,history:written.lines,requireClosing:true});}catch(error){fail('The saved script is kept, but its closing could not be prepared: '+error.message,502,'INVALID_CLOSING');}
            written={...written,lines:[...written.lines,...closing.lines]};delete written.staging;pendingWriter=written;
            await store.serial(key(profileId,id),async()=>{const latest=await store.load(profileId,'episodes',id);if(controller.signal.aborted||latest.epoch!==saved.epoch)fail('A newer direction replaced this closing.',409,'STALE_RESULT');const checkpoint={requestId:derived(input.requestId,'closing-plan'),expectedRevision:latest.revision,expectedEpoch:latest.epoch},accepted=receipt(latest,checkpoint,'production.closing-plan'),next=advance(latest,checkpoint,'production.closing-plan',accepted.hash);attachWritten(next,written,input.requestId);await store.persist(next,'episodes');});
          }
          if(!written.staging&&typeof ai.stageStudio==='function'){
            const job=inflight.get(jobKey);if(job)job.phase='staging';const directingChannel=await store.load(profileId,'channels',saved.plan.channelId);
            try{const staged=await ai.stageStudio(profileId,directingChannel?.definition.orchestrationBrain||written.brain,{cast:present,characters:present.map(member=>{const person=library.characters.find(person=>person.id===member.characterId),profile=person.studioProfile;return {id:person.id,name:person.name,personality:person.personality,behaviour:profile?.behaviour,psychology:profile?.psychology,reactionVoicePack:reactionVoicePack(person)};}),adultComedy:context.adultComedy,lines:written.lines.map(line=>({characterId:line.characterId,text:line.text,intent:line.intent,targetId:line.targetId,introducedCharacterIds:line.introducedCharacterIds}))},stagingSchema(present),controller.signal);const plan=JSON.parse(staged.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));validateStaging(plan,{cast:present,lines:written.lines});written.staging={brain:staged.brain,performanceVersion:3,...sparseStaging(plan,written.lines)};}
            catch(error){if(controller.signal.aborted)throw error;written.staging={brain:null,performanceVersion:3,lines:[],fallback:'Automatic staging was used because the AI director was unavailable.'};}
          }
          if(written.atTurn===p.cursor||!p.writer?.staging)pendingWriter=written;
          const index=p.cursor-written.atTurn,line=written.lines[index],nextLine=written.lines[index+1],introductionId=written.introductions?.[index]?.characterId,staging=written.staging?.lines.find(stage=>stage.lineIndex===index),cues=introductionId?[]:writtenPerformanceCues(line,staging,{lines:written.lines,lineIndex:index,sparse:written.staging?.performanceVersion===2});actor=library.characters.find(person=>person.id===line.characterId);text=line.text;brain=written.brain;reply={text,intent:line.intent,...(introductionId?{introductionId}:{}),...(written.staging?.performanceVersion===2?{delivery:introductionId?{schemaVersion:1,pauseMs:200,audience:'none'}:stagedDelivery(line,staging,library.characters)}:{}),respondsTo:last?.id||null,onTopic:true,cues,introducedCharacterIds:line.introducedCharacterIds,conversation:{needsReply:line.intent==='question',landed:!nextLine,nextSpeakerId:nextLine?.characterId||null}};
        }else{
        for(let attempt=0;attempt<2;attempt++){
          const result=await ai.studioTurn(profileId,actor,context,turnSchema({last,cast:present,adaptive:!!p.flow,openingIds:opening?.panel.map(member=>member.id)||[]}),controller.signal);
          if(controller.signal.aborted)fail('Contribution interrupted.',409,'INTERRUPTED');
          try{reply=JSON.parse(result.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));if(opening)reply.text=showOpening(reply.text);validateStudioReply(reply,{last,history,adaptive:!!p.flow,characterIds:present.map(member=>member.characterId),openingIds:opening?.panel.map(member=>member.id)||[]});if(p.flow&&reply.conversation.nextSpeakerId&&!flow.allowedNextSpeakerIds.includes(reply.conversation.nextSpeakerId))throw new Error('Choose an allowed next speaker so a planned reply is not interrupted.');if(saved.plan.language.primary==='hi-IN'&&(reply.text.match(/[\u0900-\u097f]/g)||[]).length<Math.max(4,(reply.text.match(/[a-z]/gi)||[]).length*.6))throw new Error('Hindi must use Devanagari, with Latin English words only for natural code mixing.');const proposed=reply.cues.map((cue,index)=>({id:derived(input.requestId,'cue/'+index),characterId:cue.characterId,actionId:cue.actionId,atMs:p.positionMs+150+index*1200,durationMs:1000,intensity:cue.intensity,...(cue.targetId?{targetId:cue.targetId}:{})}));validateCoreCues(proposed,{characterIds:present.map(member=>member.characterId),targetIds:['desk','chair','microphone','notes','pen','cup','laptop','watch','main-screen']});text=reply.text;brain=result.brain;break;}catch(error){if(attempt)fail('The show paused because a contribution failed validation: '+error.message,502,'INVALID_CONTRIBUTION');context.recovery={reason:error.message,instruction:'Respond to the last actual line; add a concrete new observation or payoff. No questions for the creator. Use no cues if unsure.'};}
        }
      }
      }
      if(controller.signal.aborted)fail('Contribution interrupted.',409,'INTERRUPTED');
      return store.serial(key(profileId,id),async()=>{
        const latest=await store.load(profileId,'episodes',id);if(controller.signal.aborted||latest.epoch!==saved.epoch||latest.production.status!=='running'||latest.production.cursor!==p.cursor)fail('A newer direction replaced this contribution.',409,'STALE_RESULT');
        const next=advance(latest,input,'production.turn',ack.hash);
        if(pendingWriter)attachWritten(next,pendingWriter,input.requestId);
        const turnId=derived(input.requestId,'turn'),turn={id:turnId,requestId:input.requestId,runId:p.runId,beatId:beat.beatId,segment:beat.segment,...(reply.intent?{intent:reply.intent}:{}),...(reply.delivery?{delivery:reply.delivery}:{}),...(reply.introductionId?{introductionId:reply.introductionId}:{}),characterId:actor.id,text,source:beat.source,brain,respondsTo:last?.id||null,scope,epoch:saved.epoch,at:next.updatedAt,startMs:p.positionMs,characterSnapshot:structuredClone(actor)};
        next.production.turns.push(turn);next.production.cursor++;next.production.awaitingPlayback=turnId;
        if(next.production.flow&&reply.conversation){const f=next.production.flow,c=reply.conversation;f.pendingQuestionTo=c.needsReply?c.nextSpeakerId:null;const detourPending=next.production.banter&&next.production.cursor<=next.production.banter.startIndex+2;
          if(c.landed&&!c.needsReply&&!detourPending&&next.production.cursor>=f.minTurns){turn.segment='payoff';next.production.schedule=next.production.schedule.slice(0,next.production.cursor);next.production.turnLimit=next.production.cursor;}
          else if(c.nextSpeakerId&&next.production.schedule[next.production.cursor]&&!(p.banter&&next.production.cursor>=p.banter.startIndex&&next.production.cursor<=p.banter.startIndex+2))next.production.schedule[next.production.cursor].speakerId=c.nextSpeakerId;
        }
        const generated=next.plan.beats.find(item=>item.id===beat.beatId&&item.origin==='generated'&&!item.locked);if(generated)generated.text=text;
        if(!next.plan.beats.some(item=>item.id===beat.beatId))next.plan.beats.push({schemaVersion:1,id:beat.beatId,segment:beat.segment,kind:'speech',speakerId:actor.id,text,origin:'generated',locked:false});
        for(const [index,cue] of reply.cues.entries())next.production.cues.push({schemaVersion:1,id:derived(input.requestId,'cue/'+index),characterId:cue.characterId,actionId:cue.actionId,atMs:p.positionMs+150+index*1200,durationMs:1000,intensity:cue.intensity,...(cue.targetId?{targetId:cue.targetId}:{}),triggerTurnId:turnId,runId:p.runId});
        await store.persist(next,'episodes');return {episode:next,turn,replayed:false};
      });
    })().catch(async error=>{
      if(started)await store.serial(key(profileId,id),async()=>{const saved=await store.load(profileId,'episodes',id);if(saved?.epoch===input.expectedEpoch&&saved?.production?.status==='running'&&!saved.events.some(event=>event.requestId===input.requestId)){const failureInput={...input,requestId:derived(input.requestId,'failure')},ack=receipt(saved,{...failureInput,expectedRevision:saved.revision,expectedEpoch:saved.epoch},'production.failure'),next=advance(saved,failureInput,'production.failure',ack.hash,true);next.production.status='paused';next.production.reason=controller.signal.aborted?'Playback was disconnected or interrupted. Saved lines are kept.':(error instanceof SessionError?error.message.slice(0,600):'A provider or contribution failed. Saved lines are kept; retry deliberately.');await store.persist(next,'episodes');}}).catch(()=>{});
      throw error;
    }).finally(()=>{signal?.removeEventListener('abort',disconnect);if(inflight.get(jobKey)?.controller===controller)inflight.delete(jobKey);});inflight.set(jobKey,{controller,requestId:input.requestId,promise:work});return work;
  }
  function startDetached(profileId,id,input){
    const jobId=key(profileId,id)+'/'+input.requestId,signature=JSON.stringify(input,Object.keys(input).sort()),prior=jobs.get(jobId);if(prior){if(prior.signature!==signature)fail('This request identifier belongs to a different preparation.',409,'REQUEST_CONFLICT');return {pending:true,requestId:input.requestId};}
    if(jobs.size>=100)jobs.delete(jobs.keys().next().value);jobs.set(jobId,{signature,pending:true});
    void turn(profileId,id,input).then(()=>jobs.set(jobId,{signature,pending:false}),error=>{console.error('Studio preparation failed:',error?.stack||error);try{onError(error);}catch{}return jobs.set(jobId,{signature,pending:false,error:{status:Number.isInteger(error.status)?error.status:500,message:Number.isInteger(error.status)?error.message:'Scene preparation failed. Saved work is kept.',code:error.code||'PREPARATION_FAILED'}});});
    return {pending:true,requestId:input.requestId};
  }
  async function progress(profileId,id,requestId=null){
    const active=inflight.get(key(profileId,id)+'/turn');if(!requestId)return {pending:!!active,phase:active?.phase||'idle',requestId:active?.requestId||null,...(!active?{episode:await store.load(profileId,'episodes',id)}:{})};
    const job=jobs.get(key(profileId,id)+'/'+requestId);if(job?.error)return {pending:false,error:job.error};
    if(active?.requestId===requestId||job?.pending)return {pending:true,phase:active?.phase||'writing',requestId};
    const episode=await store.load(profileId,'episodes',id);if(episode?.events.some(event=>event.requestId===requestId&&event.operation==='production.turn'))return {pending:false,episode,turn:episode.production?.turns.find(turn=>turn.requestId===requestId),replayed:true};
    return {pending:false,error:{status:409,code:'PREPARATION_INTERRUPTED',message:'Preparation was interrupted. Resume the saved show to continue.'}};
  }
  async function voice(profileId,id,input,signal){
    const snapshot=await store.load(profileId,'episodes',id);if(!snapshot||snapshot.deletedAt)fail('Choose an owned episode.',404);const accepted=receipt(snapshot,input,'production.voice');
    const turn=snapshot.production?.turns.find(turn=>turn.id===input.turnId);if(!turn)fail('Choose an actual saved contribution.',404);
    if(turn.voiceAssetId)return {episode:snapshot,asset:await speech.get(profileId,turn.voiceAssetId)};
    const controller=new AbortController(),jobKey=key(profileId,id)+'/voice';if(inflight.has(jobKey))fail('Speech is already being prepared.',409);inflight.set(jobKey,{controller});const disconnect=()=>controller.abort();signal?.addEventListener('abort',disconnect,{once:true});
    try{const asset=await speech.prepare(profileId,turn.characterSnapshot,turn.text,snapshot.plan.language,controller.signal,{intent:turn.intent});
      return await store.serial(key(profileId,id),async()=>{const saved=await store.load(profileId,'episodes',id);if(controller.signal.aborted||saved.epoch!==snapshot.epoch)fail('Speech preparation was replaced by a newer direction.',409,'STALE_RESULT');if(accepted.replayed)return {episode:saved,asset};const next=advance(saved,input,'production.voice',accepted.hash),current=next.production.turns.find(item=>item.id===turn.id);current.voiceAssetId=asset.id;current.durationMs=asset.durationMs;timeGeneratedCues(next.production.cues,current,asset.durationMs,next.production.writer?.staging?.lines.find(stage=>stage.lineIndex===activeTurns(next.production).findIndex(turn=>turn.id===current.id)-next.production.writer.atTurn));for(const cue of next.production.cues.filter(cue=>cue.triggerTurnId===turn.id)){cue.atMs=Math.floor(Math.min(cue.atMs,turn.startMs+Math.max(0,asset.durationMs-100)));cue.durationMs=Math.max(1,Math.floor(Math.min(cue.durationMs,turn.startMs+asset.durationMs-cue.atMs)));}let position=0;for(const line of activeTurns(next.production)){const before=line.startMs;line.startMs=position;for(const cue of next.production.cues.filter(cue=>cue.triggerTurnId===line.id))cue.atMs=Math.max(position,Math.round(cue.atMs+position-before));position+=Math.ceil(line.durationMs||Math.max(1200,line.text.length*42));}next.production.positionMs=position;
      await store.persist(next,'episodes');return {episode:next,asset};});
    }finally{signal?.removeEventListener('abort',disconnect);inflight.delete(jobKey);}
  }
  return {bootstrap,control,turn,voice,startDetached,progress,abort,invalidate};
}
