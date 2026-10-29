import {deliveryPause} from './delivery.mjs';
const hash=text=>[...text].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
export function vocalReactionEvents(lines){
 let position=0;const events=[];
 for(const line of lines){
  const edited=Number.isFinite(line.pauseAfterMs),startMs=edited?line.startMs:position,durationMs=line.durationMs||Math.min(15000,Math.max(1200,(line.text||'').length*42)),pauseMs=edited?line.pauseAfterMs:deliveryPause(line),reaction=line.delivery?.reaction;
  if(reaction&&['chuckle','sigh'].includes(reaction.vocal)&&pauseMs>=1200){const variant=1+hash(line.id+'/'+reaction.characterId)%2;events.push({id:line.id+':'+reaction.characterId,characterId:reaction.characterId,kind:reaction.vocal,path:`/audio/reactions/${reaction.voicePack}-${reaction.vocal}-${variant}.ogg`,startMs:startMs+durationMs+120,durationMs:Math.min(1150,pauseMs-240),gain:.75+reaction.intensity*.3,pan:(hash(reaction.characterId)%41-20)/100});}
  position=startMs+durationMs+pauseMs;
 }
 return events;
}
