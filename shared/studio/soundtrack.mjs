import {deliveryAudience} from './delivery.mjs';
export const MUSIC_LEVELS=Object.freeze({intro:.34,bed:.095,audience:.055,outro:.32});
const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
// The same mix profile drives live playback and the offline export.
export function soundtrackGain({programmeTimeMs=0,outro=false,outroProgress=0,audience=false}={}){
 const entrance=Math.min(1,Math.max(0,programmeTimeMs)/180);
 if(outro){const p=Math.max(0,Math.min(1,outroProgress));return entrance*(MUSIC_LEVELS.bed+(MUSIC_LEVELS.outro-MUSIC_LEVELS.bed)*smooth(0,.06,p))*(1-smooth(.25,1,p));}
 const bed=audience?MUSIC_LEVELS.audience:MUSIC_LEVELS.bed;
 return entrance*(bed+(MUSIC_LEVELS.intro-bed)*(1-smooth(6000,6800,programmeTimeMs)));
}
export function soundtrackGainAt(timeMs,lines){
 const line=lines.find(line=>timeMs>=line.startMs&&timeMs<line.startMs+line.durationMs+line.pauseAfterMs);if(!line)return 0;
 const inPause=timeMs>=line.startMs+line.durationMs;
 return soundtrackGain({programmeTimeMs:timeMs,outro:inPause&&line.intent==='closing',outroProgress:inPause?(timeMs-line.startMs-line.durationMs)/Math.max(1,line.pauseAfterMs):0,audience:inPause&&deliveryAudience(line)});
}
