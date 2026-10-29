import {deliveryPause} from './delivery.mjs';
import {getAction} from './actions.mjs';
import {motionDuration} from './motion-library.mjs';
import {activeTurns} from './production.mjs';

const sharesLane=(a,b)=>a.characterId===b.characterId&&getAction(a.actionId).lanes.some(lane=>getAction(b.actionId).lanes.includes(lane));
const unsafeSpeaker=new Set(['props.drink-water','fatigue.yawn','fatigue.sleep-on-desk']);
function speakerGestureAllowed(lines,index){
 let last=-3,previous=null;for(let n=0;n<=index;n++){const line=lines[n],cue=line?.cues?.find(cue=>cue.characterId===line.characterId&&!unsafeSpeaker.has(cue.actionId));if(!cue||n-last<3||previous?.characterId===cue.characterId&&previous.actionId===cue.actionId&&n-last<6)continue;last=n;previous=cue;}return last===index;
}
export function writtenPerformanceCues(line,staging,{lines=[],lineIndex=0,sparse=false}={}){
  if(!line||line.intent==='closing')return [];
  const result=staging?.reactionCharacterId&&staging.reactionTiming!=='after'?[{characterId:staging.reactionCharacterId,actionId:staging.reactionActionId,...(staging.reactionCharacterId!==line.characterId?{targetId:line.characterId}:{}),intensity:staging.intensity}]:[];
  for(const cue of line.cues||[]){
    if(staging?.reactionCharacterId===cue.characterId&&result.some(other=>sharesLane(cue,other)))continue;
    if(cue.characterId===line.characterId&&unsafeSpeaker.has(cue.actionId))continue;
    const small=/^(expression\.|response\.(raise-eyebrow|sceptical-look|nod|shake-head)|listening\.(puzzled-tilt|attentive-nod)|comedy\.(smirk|deadpan-stare))/.test(cue.actionId);
    if(sparse&&!small&&(cue.characterId===line.characterId&&!speakerGestureAllowed(lines,lineIndex)||result.some(item=>sharesLane(item,cue))))continue;
    if(!result.some(other=>sharesLane(cue,other))&&result.length<2)result.push({...cue,...(cue.targetId===null?{targetId:undefined}:{}),intensity:Math.min(.8,cue.intensity)});
  }
  return result;
}

// Recover writer directions discarded by the old staging implementation. This
// is a read-only playback adapter; saved dialogue, WAVs and takes stay intact.
export function resolvedPerformanceCues(production){
  if(!production)return [];
  const turns=activeTurns(production),ids=new Set(turns.map(turn=>turn.id));
  const saved=production.cues.filter(cue=>cue.runId===production.runId&&ids.has(cue.triggerTurnId)),result=[...saved],written=production.writer;
  if(!written?.staging||written.staging.performanceVersion===3)return result;
  for(const [index,turn]of turns.entries()){
    const line=written.lines[index-written.atTurn];if(!line||line.characterId!==turn.characterId||!turn.durationMs)continue;
    const stage=written.staging.lines.find(item=>item.lineIndex===index-written.atTurn);
    for(const [n,cue]of writtenPerformanceCues(line,null,{lines:written.lines,lineIndex:index-written.atTurn,sparse:true}).entries()){
      // Recover deliberate face/head cues as well as sparse speaker gestures.
      const subtle=/^(expression\.|response\.(nod|shake-head|raise-eyebrow|sceptical-look)|listening\.(puzzled-tilt|attentive-nod)|comedy\.(smirk|deadpan-stare))/.test(cue.actionId);
      if(!subtle&&(cue.characterId!==turn.characterId||written.staging.performanceVersion===2))continue;
      const atMs=Math.round(turn.startMs+Math.min(550,turn.durationMs*.12)),durationMs=Math.floor(Math.min(motionDuration(cue.actionId),turn.startMs+turn.durationMs-atMs));
      if(durationMs<900)continue;
      const recovered={...cue,id:`writer-performance:${turn.id}:${n}`,runId:production.runId,triggerTurnId:turn.id,atMs,durationMs};
      if(result.some(other=>sharesLane(recovered,other)&&other.atMs<atMs+durationMs&&atMs<other.atMs+other.durationMs))continue;
      result.push(recovered);
    }
  }
  return result;
}

// Map saved source-time directions onto the continuous edited programme clock.
// Listener holds after a punchline live in the pause, never over the next voice.
const timelineCache=new WeakMap();
const programmeCache=new WeakMap();
const editedProgrammeCache=new WeakMap();
export function performanceTimeline(production,lines){
 if(!production)return lines||[];if(lines){const cached=editedProgrammeCache.get(lines);if(cached?.production===production)return cached.timeline;const source=activeTurns(production),timeline=lines.map(line=>({...line,scriptIndex:source.findIndex(turn=>turn.id===line.id)}));editedProgrammeCache.set(lines,{production,timeline});return timeline;}const cached=programmeCache.get(production);if(cached)return cached;
 let position=0;const result=activeTurns(production).map((turn,scriptIndex)=>{const durationMs=turn.durationMs||Math.min(15000,Math.max(1200,(turn.text||'').length*42)),line={...turn,scriptIndex,sourceStartMs:turn.startMs,durationMs,startMs:position,trimStartMs:0,trimEndMs:durationMs,pauseAfterMs:deliveryPause(turn,{enabled:!!production.writer})};position+=durationMs+line.pauseAfterMs;return line;});programmeCache.set(production,result);return result;
}
export function performanceTimelineCues(production,lines){
 if(!production)return [];const cached=timelineCache.get(production);if(cached&&cached.lines===lines)return cached.cues;const turns=activeTurns(production),timeline=performanceTimeline(production,lines);
 const byId=new Map(timeline.map(line=>[line.id,line])),result=[];
 for(const cue of resolvedPerformanceCues(production)){
  const line=byId.get(cue.triggerTurnId),source=turns.find(turn=>turn.id===cue.triggerTurnId);if(!line||!source)continue;
  const start=cue.atMs-source.startMs-(line.trimStartMs||0),end=lines||line.delivery?Math.min(line.durationMs,start+cue.durationMs):start+cue.durationMs;if(end<=0||start>=line.durationMs)continue;
  result.push({...cue,atMs:line.startMs+Math.max(0,start),durationMs:end-Math.max(0,start)});
 }
 for(const line of timeline){const r=line.delivery?.reaction;if(!r||line.pauseAfterMs<450)continue;const margin=Math.min(120,line.pauseAfterMs*.12);result.push({id:`listener-hold:${line.id}`,characterId:r.characterId,actionId:r.actionId,targetId:line.characterId,intensity:r.intensity,atMs:line.startMs+line.durationMs+margin,durationMs:Math.min(2100,line.pauseAfterMs-margin*2),triggerTurnId:line.id,runId:production.runId});}
 timelineCache.set(production,{lines,cues:result});return result;
}
