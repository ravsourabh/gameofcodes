import * as THREE from 'three';
export type Shot='auto'|'wide'|'host'|'speaker'|'two-person'|'reaction'|'close-up'|'screen';
export const OPENING_DURATION_MS=5200;
// A deterministic crane/drone move, followed by a cut to camera two. Playback,
// seeking and exported video all use the same recording clock.
export function openingCameraPose(camera:THREE.PerspectiveCamera,timeMs:number,host:THREE.Vector3,aspect=16/9,duration=OPENING_DURATION_MS){
  const cut=duration*.64,t=THREE.MathUtils.clamp(timeMs/cut,0,1),ease=t*t*(3-2*t);
  const start=new THREE.Vector3(3.5,3.35,5.5),finish=host.clone().add(new THREE.Vector3(1.05,.23,aspect<1?2.0:2.5));
  const arc=new THREE.QuadraticBezierCurve3(start,new THREE.Vector3(1.0,2.85,1.8),finish);
  const position=timeMs<cut?arc.getPoint(ease):host.clone().add(new THREE.Vector3(-.55,.13,aspect<1?1.7:2.0));
  const target=new THREE.Vector3(0,1.3,-2.12).lerp(host,ease);
  camera.aspect=aspect;camera.position.copy(position);camera.lookAt(timeMs<cut?target:host);camera.fov=timeMs<cut?THREE.MathUtils.lerp(55,36,ease):34;camera.updateProjectionMatrix();
  // The host anticipates the cut, turning before the audience switches cameras.
  const turn=THREE.MathUtils.smoothstep(timeMs,cut-650,cut+350);
  return {phase:timeMs<cut?'fly-in':'camera-two',hostYaw:THREE.MathUtils.lerp(.3,-.2,turn),attention:host.clone().add(new THREE.Vector3(THREE.MathUtils.lerp(1.05,-.55,turn),.15,2.3))};
}
// One continuous pull-out after the final spoken word, shared with export.
export function closingCameraPose(camera:THREE.PerspectiveCamera,progress:number,host:THREE.Vector3,aspect=16/9){
  const t=THREE.MathUtils.clamp(progress,0,1),ease=t*t*(3-2*t),start=host.clone().add(new THREE.Vector3(.28,.12,aspect<1?1.7:2));
  const arc=new THREE.QuadraticBezierCurve3(start,new THREE.Vector3(1.0,2.85,1.8),new THREE.Vector3(3.5,3.35,5.5));
  camera.aspect=aspect;camera.position.copy(arc.getPoint(ease));camera.lookAt(host.clone().lerp(new THREE.Vector3(0,1.3,-2.12),ease));camera.fov=THREE.MathUtils.lerp(aspect<1?39:34,55,ease);camera.updateProjectionMatrix();
  return {phase:'fly-out',progress:t};
}
type CoverageTurn={scriptIndex?:number;id:string;characterId:string;startMs:number;durationMs?:number;pauseAfterMs?:number;trimStartMs?:number;introductionId?:string;respondsTo?:string|null};
export function timedCoverage<T extends {turnId:string;atFraction:number}>(timeMs:number,turns:CoverageTurn[],cues:T[],sourceTurns:CoverageTurn[]=turns){
 for(const cue of [...cues].reverse()){
  const line=turns.find(turn=>turn.id===cue.turnId),source=sourceTurns.find(turn=>turn.id===cue.turnId);if(!line||!source)continue;
  const offset=(source.durationMs||10000)*cue.atFraction-(line.trimStartMs||0),duration=line.durationMs||10000;if(offset<0||offset>=duration)continue;
  const start=line.startMs+offset,end=Math.min(start+3200,line.startMs+duration+(line.pauseAfterMs||0));if(timeMs>=start&&timeMs<end)return cue;
 }return null;
}
type CoverageCue={characterId:string;atMs:number;durationMs:number;intensity?:number;actionId?:string;triggerTurnId?:string};
type CoverageOptions={hostId?:string;staging?:{atTurn:number;lines:{lineIndex:number;shot:string;shotTargetId?:string|null;reactionCharacterId:string|null;reactionTiming?:string;atFraction:number}[]};script?:{targetId:string|null;intent?:string}[]};
const coverageCache=new WeakMap<CoverageTurn[],{cues:CoverageCue[];staging:unknown;script:unknown;host?:string;events:any[]}>();
export function automaticCoverage(timeMs:number,turns:CoverageTurn[],cues:CoverageCue[]=[],options:CoverageOptions={}){
 let cached=coverageCache.get(turns);
 if(!cached||cached.cues!==cues||cached.staging!==options.staging?.lines||cached.script!==options.script||cached.host!==options.hostId){
  const events:any[]=[];let lastAt=-Infinity,lastKey='';
  const select=(shot:Shot,speaker:string,focus:string|null,at:number,end:number,hold=2000,handoff=false)=>{
   const subject=shot==='host'?options.hostId||speaker:shot==='reaction'||shot==='close-up'?focus||speaker:speaker;
   const key=shot==='wide'?'wide':shot==='two-person'?'pair:'+([speaker,focus||speaker].sort().join('/')):shot+':'+subject;
   if(key===lastKey)return;
   // Delay a cut inside this turn instead of silently discarding the handoff.
   let scheduled=Math.max(at,lastAt+hold);if(scheduled>end-300){if(!handoff)return;scheduled=Math.max(at,lastAt,end-300);}if(scheduled>=end)return;
   events.push({shot,focusId:focus,viewSpeakerId:shot==='host'?options.hostId||speaker:speaker,at:scheduled,key});lastAt=scheduled;lastKey=key;
  };
  for(const [index,turn]of turns.entries()){
   const duration=turn.durationMs||10000,end=turn.startMs+duration,pauseEnd=end+(turn.pauseAfterMs||0),stage=options.staging?.lines.find(line=>line.lineIndex===(turn.scriptIndex??index)-options.staging!.atTurn),script=options.script?.[(turn.scriptIndex??index)-(options.staging?.atTurn||0)],previous=turns[index-1];
   const other=script?.targetId||previous?.characterId||turns.find(t=>t.characterId!==turn.characterId)?.characterId||null;
   const introduced=turn.introductionId,explicit=stage?.shot;
   const base:Shot=script?.intent==='closing'?'host':introduced?'close-up':explicit&&['host','wide','two-person','speaker','close-up'].includes(explicit)?explicit as Shot:duration<4000&&other&&other!==turn.characterId?'two-person':'speaker';
   const focus=base==='close-up'?introduced||stage?.shotTargetId||turn.characterId:other;
   select(base,turn.characterId,focus,turn.startMs,pauseEnd,introduced?0:2000,true);
   if(script?.intent==='closing'||introduced)continue;
   const listeners=cues.filter(c=>c.characterId!==turn.characterId&&(c.triggerTurnId?c.triggerTurnId===turn.id:c.atMs>=turn.startMs&&c.atMs<pauseEnd)&&c.atMs<pauseEnd&&c.atMs+c.durationMs>turn.startMs).sort((a,b)=>(b.intensity||0)-(a.intensity||0));
   const reaction=listeners[0];if(!reaction)continue;
   const after=reaction.atMs>=end,at=Math.max(turn.startMs+500,reaction.atMs-160),finish=Math.min(pauseEnd,reaction.atMs+reaction.durationMs+120);
   if(finish-at<350)continue;
   select('reaction',turn.characterId,reaction.characterId,at,finish,after?650:1800);
   if(finish+900<end)select(base,turn.characterId,focus,finish,end,1400);
  }
  cached={cues,staging:options.staging?.lines,script:options.script,host:options.hostId,events};coverageCache.set(turns,cached);
 }
 let selected:any={shot:'wide',focusId:null,viewSpeakerId:null,at:-Infinity,key:'wide'};
 for(const event of cached.events){if(event.at>timeMs)break;selected=event;}
 const elapsed=Number.isFinite(selected.at)?Math.max(0,timeMs-selected.at):0;return {...selected,progress:Math.min(1,elapsed/14000)};
}

export function cameraPose(camera:THREE.PerspectiveCamera,shot:Shot,actors:Map<string,THREE.Vector3>,speakerId:string|null,hostId?:string,aspect=16/9,focusId?:string|null,progress=0){
  const positions=[...actors.values()],speaker=actors.get(speakerId||'')||positions[0]||new THREE.Vector3(0,1.22,-2.12),host=actors.get(hostId||'')||positions[0]||speaker,other=(focusId!==speakerId?actors.get(focusId||''):null)||positions.filter(p=>p!==speaker).sort((a,b)=>a.distanceTo(speaker)-b.distanceTo(speaker))[0]||speaker;
  let target=new THREE.Vector3(0,1.38,-2.4),position=new THREE.Vector3(0,1.55,3.3),fov=48;
  if(shot==='host'||shot==='speaker'||shot==='reaction'||shot==='close-up'){target.copy(shot==='close-up'?(actors.get(focusId||'')||speaker):shot==='host'?host:shot==='reaction'?actors.get(focusId||'')||other:speaker);position.copy(target).add(new THREE.Vector3((shot==='reaction'?-.3:.28)+Math.sin(progress*Math.PI)*.025,.12,(aspect<1?1.7:2.0)-progress*.035));fov=shot==='close-up'?(aspect<1?31:25):aspect<1?39:34;}
  if(shot==='two-person'){target.copy(speaker).add(other).multiplyScalar(.5);position.copy(target).add(new THREE.Vector3(0,.2,aspect<1?5.2:3.2));fov=46;}
  if(shot==='screen'){target.set(0,3.0,-4.3);position.set(0,3.0,aspect<1?2.2:.1);fov=aspect<1?60:39;}
  camera.aspect=aspect;camera.position.copy(position);camera.lookAt(target);camera.fov=fov;camera.updateProjectionMatrix();
}
