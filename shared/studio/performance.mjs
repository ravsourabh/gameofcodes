import {ACTIONS,getAction,validateCues} from './actions.mjs';
import {MOTION_ACTIONS,MOTION_BINDINGS,STAGE_ONLY_ACTIONS} from './motion-library.mjs';
export const CORE_ACTIONS=MOTION_ACTIONS;
export const REQUIRED_BONES=['Head','Neck','Spine2','L UpperArm','R UpperArm','L Forearm','R Forearm','L Hand','R Hand'];
export const REQUIRED_MORPHS=['AA_VI_01_PP','AA_VI_02_FF','AA_VI_10_aa','AA_VI_11_E','AA_VI_13_O','AA_VI_14_U'];
export function performanceCatalogue(characterId,{bones=[],morphs=[],props=['desk','chair','microphone','notes'],verified=false,motionReady=false}={}){
  const rigReady=verified&&REQUIRED_BONES.every(name=>bones.includes(name))&&REQUIRED_MORPHS.every(name=>morphs.includes(name));
  return ACTIONS.map(action=>{const binding=MOTION_BINDINGS[action.id],extra=binding?.mode==='standing'?['Pelvis','Spine','Spine1','L Thigh','R Thigh','L Calf','R Calf','L Foot','R Foot']:binding?.clip?['Spine','Spine1','L Clavicle','R Clavicle']:[];if(['count','raise-finger','write','tap-fingers','laptop'].includes(binding?.contact))extra.push('R Finger1','R Finger11','L Finger1');const supported=rigReady&&extra.every(name=>bones.includes(name));return {characterId,actionId:action.id,status:STAGE_ONLY_ACTIONS.includes(action.id)?'needs-staging':!CORE_ACTIONS.includes(action.id)?'needs-animation':!supported?'unsupported-rig':action.props.some(prop=>!props.includes(prop))?'needs-prop':MOTION_BINDINGS[action.id]?.clip&&!motionReady?'loading-motion':'ready'};});
}
export function validateCoreCues(cues,context){validateCues(cues,context);for(const cue of cues)if(!CORE_ACTIONS.includes(cue.actionId))throw new Error('That action is catalogued but its animation is not ready.');return cues;}
export function performanceSample(cues,timeMs,{characterId,reducedMotion=false}={}){
  const active=cues.filter(cue=>cue.characterId===characterId&&timeMs>=cue.atMs&&timeMs<cue.atMs+cue.durationMs);
  return active.map(cue=>{const elapsed=timeMs-cue.atMs,progress=elapsed/cue.durationMs,standing=MOTION_BINDINGS[cue.actionId]?.mode!=='seated',smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);},fade=smooth(elapsed/Math.min(standing?1100:650,cue.durationMs*.3))*smooth((cue.durationMs-elapsed)/Math.min(standing?1200:750,cue.durationMs*.35));return {actionId:cue.actionId,targetId:cue.targetId,intensity:cue.intensity*fade*(reducedMotion?.35:1),progress,envelope:fade,elapsedMs:elapsed,durationMs:cue.durationMs,motionScale:reducedMotion?.35:1};});
}
export function reactionCue({id,characterId,actionId,atMs=0,beatId,targetId,intensity=.5,durationMs=1200}){
  getAction(actionId);return {schemaVersion:1,id,characterId,actionId,atMs,durationMs,intensity,...(beatId?{beatId}:{}),...(targetId?{targetId}:{})};
}
