// Replayable attention, chosen per person rather than one group turn at every line.
const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const mix=(a,b,t)=>{const out={};for(const [id,weight] of Object.entries(a))out[id]=(out[id]||0)+weight*(1-t);for(const [id,weight] of Object.entries(b))out[id]=(out[id]||0)+weight*t;return out;};
export function attentionSample({characterId,turns,timeMs,hostId,script=[],atTurn=0,energy=.5}){
 const events=[];let weights={neutral:1},transition=null,lastTarget='neutral',lastAt=-Infinity,delayMs=0;
 const sample=time=>transition?mix(transition.from,{[transition.target]:1},ease((time-transition.at)/transition.duration)):weights;
 for(const [index,line] of turns.entries()){
  if(line.startMs>timeMs)break;const seed=hash(characterId+'/'+line.id),unit=seed/4294967296,previous=turns[index-1],written=script[index-atTurn],speaking=line.characterId===characterId,addressed=written?.targetId===characterId;
  let target,delay;
  if(speaking){if(previous?.characterId===characterId&&!written?.targetId)continue;target=written?.targetId&&written.targetId!==characterId?written.targetId:characterId===hostId||unit<.2?'broadcast':previous?.characterId!==characterId?previous?.characterId||'broadcast':'broadcast';delay=100+(seed%240);}
  else{if(!addressed&&seed%100<36)continue;target=line.characterId;delay=addressed?160+seed%240:650+seed%1000;}
  if(target===characterId)target='neutral';const at=line.startMs+delay;if(turns[index+1]&&at>=turns[index+1].startMs)continue;if(at<=timeMs)events.push({target,at,delay,speaking,addressed,duration:(speaking?500:720)+seed%430+(1-Math.max(0,Math.min(1,energy)))*240});
 }
 for(const event of events.sort((a,b)=>a.at-b.at)){
  const {target,at,speaking,addressed,duration,delay}=event;if(target===lastTarget)continue;
  // A quiet listener keeps their attention through rapid back-and-forth.
  if(!speaking&&!addressed&&at-lastAt<2200)continue;
  weights=sample(at);transition={from:weights,target,at,duration};lastTarget=target;lastAt=at;delayMs=delay;
 }
 return {weights:sample(timeMs),targetId:lastTarget,changedAtMs:Math.max(-1,lastAt),delayMs};
}
