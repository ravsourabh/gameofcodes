import {AFTER_REACTION_ACTIONS,SEATED_REACTION_ACTIONS,reactionPauseFloor} from '../shared/studio/delivery.mjs';
import {modelForAppearance} from '../shared/avatar-catalog.mjs';
import {createHash} from 'node:crypto';
const number=value=>createHash('sha256').update(value).digest().readUInt32LE(0);
export function reactionVoicePack(person){const female=/female/i.test(person?.avatar?modelForAppearance(person.avatar):'');return `${female?'female':'male'}-${1+number(person.id)%2}`;}
export function stagedDelivery(line,stage,characters){
 const seed=number(line.characterId+'/'+line.text),ordinary=260+seed%181;
 const pauseMs=line.intent==='question'?140+seed%101:line.intent==='answer'&&line.text.length<75?160+seed%141:line.intent==='aside'?650+seed%251:['payoff','callback'].includes(line.intent)?900+seed%351:ordinary;
 const result={schemaVersion:1,pauseMs:line.intent==='question'?Math.min(300,stage?.pauseMs??pauseMs):stage?.pauseMs??pauseMs,audience:stage?.audience||'none'};
 if(line.intent==='closing')return {...result,pauseMs:380,audience:'none'};
 const person=characters.find(person=>person.id===stage?.reactionCharacterId);
 if(line.intent!=='question'&&person&&person.id!==line.characterId&&stage.reactionTiming==='after'&&stage.reactionActionId){
 const supported=[...AFTER_REACTION_ACTIONS,...SEATED_REACTION_ACTIONS];
  if(supported.includes(stage.reactionActionId)){
   const energy=person.studioProfile?.behaviour?.energy??.5;
   result.reaction={characterId:person.id,actionId:stage.reactionActionId,intensity:Math.min(.65,stage.intensity*(.65+energy*.45)),vocal:stage.vocal||'none',voicePack:reactionVoicePack(person)};
   result.pauseMs=Math.max(result.pauseMs,reactionPauseFloor(result.reaction),900);
  }
 }
 if(result.reaction?.vocal!=='none'&&result.reaction?.vocal)result.audience='none';
 if(result.audience==='light')result.pauseMs=Math.max(1600,result.pauseMs);
 return result;
}
