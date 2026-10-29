import {CORE_ACTIONS} from './performance.mjs';
import {MOTION_BINDINGS} from './motion-library.mjs';
export const SEATED_REACTION_ACTIONS=Object.freeze(CORE_ACTIONS.filter(id=>MOTION_BINDINGS[id]?.mode==='seated'&&!/^(speaking\.|movement\.|celebration\.)/.test(id)&&!['fatigue.sleep-on-desk','fatigue.nod-off','fatigue.startle-awake','props.type-on-laptop'].includes(id)));
export const AFTER_REACTION_ACTIONS=Object.freeze(CORE_ACTIONS.filter(id=>id.startsWith('expression.')||['response.nod','response.shake-head','response.raise-eyebrow','response.sceptical-look','response.look-to-host','response.concede-point','response.reluctantly-agree','response.dismiss-argument','listening.attentive-nod','listening.acknowledge-point','listening.puzzled-tilt','listening.thoughtful-pause','comedy.chuckle','comedy.suppress-laughter','comedy.deadpan-stare','comedy.smirk'].includes(id)));
export function reactionPauseFloor(reaction){if(reaction.vocal&&reaction.vocal!=='none')return 1600;return reaction.actionId.startsWith('expression.')||['response.raise-eyebrow','response.sceptical-look','comedy.smirk','comedy.deadpan-stare'].includes(reaction.actionId)?450:1200;}
export const CLOSING_PAUSE_MS=5200;
// Stable delivery timing shared by playback, takes and captions.
export function deliveryPause(line,{enabled=true}={}){if(!enabled)return 0;if(line.intent==='closing')return CLOSING_PAUSE_MS;if(line.delivery?.schemaVersion===1&&Number.isInteger(line.delivery.pauseMs))return Math.max(100,Math.min(2600,line.delivery.pauseMs));if(line.intent==='payoff'||!line.intent&&line.segment==='payoff')return 1900;return /[?？]\s*$/.test(line.text||'')?260:380;}
// Old accepted takes retain their original pauses and audience policy.
export function deliveryAudience(line){return line?.delivery?.schemaVersion===1?line.delivery.audience==='light':line?.intent==='payoff'||!line?.intent&&line?.segment==='payoff';}
export function validateDelivery(value,characterIds){
 if(value===undefined)return;const allowed=['schemaVersion','pauseMs','audience','reaction'];if(!value||Object.keys(value).some(key=>!allowed.includes(key))||value.schemaVersion!==1||!Number.isInteger(value.pauseMs)||value.pauseMs<100||value.pauseMs>2600||!['none','light'].includes(value.audience))throw new Error('Use bounded delivery timing.');
 if(value.reaction!==undefined){const r=value.reaction;if(!r||Object.keys(r).some(key=>!['characterId','actionId','intensity','vocal','voicePack'].includes(key))||!characterIds.includes(r.characterId)||![...AFTER_REACTION_ACTIONS,...SEATED_REACTION_ACTIONS].includes(r.actionId)||!Number.isFinite(r.intensity)||r.intensity<0||r.intensity>.65||!['none','chuckle','sigh'].includes(r.vocal)||!['male-1','male-2','female-1','female-2'].includes(r.voicePack)||value.pauseMs<reactionPauseFloor(r))throw new Error('Use a quiet, bounded listener reaction.');}
 if(value.audience==='light'&&(value.pauseMs<1600||value.reaction?.vocal&&value.reaction.vocal!=='none'))throw new Error('Leave room for an audience reaction without another vocal.');
 return value;
}

// Source cues stop at the end of the recording; idle motion keeps the pauses
// in its programme clock. Neither clock switches to wall time between lines.
export function deliveryClock(turn,localMs,{turns=[],enabled=true,durationMs=turn?.durationMs}={}){
 if(!turn)return {sourceTimeMs:0,programmeTimeMs:0,localMs:0};
 const duration=line=>line.durationMs||Math.min(15000,Math.max(1200,(line.text||'').length*42));
 const length=durationMs||duration(turn),pause=deliveryPause(turn,{enabled}),elapsed=Math.max(0,Math.min(length+pause,localMs));
 const index=turns.findIndex(line=>line.id===turn.id),before=index<0?[]:turns.slice(0,index),start=before.reduce((sum,line)=>sum+duration(line)+deliveryPause(line,{enabled}),0);
 return {sourceTimeMs:(turn.startMs||0)+Math.min(length,elapsed),programmeTimeMs:start+elapsed,localMs:elapsed};
}
