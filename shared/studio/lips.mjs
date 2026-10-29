// The cue times come from the final audio recognizer, never from wall time,
// character counts or a synthetic sine wave. Shape names follow Rhubarb's map.
export const LIP_SHAPES=Object.freeze({
  X:{open:0,round:0,wide:0,hiss:0,visemes:{}},
  A:{open:0,round:0,wide:0,hiss:0,visemes:{AA_VI_01_PP:1}},
  B:{open:.12,round:0,wide:.35,hiss:.35,visemes:{AA_VI_07_SS:.55,AA_VI_12_I:.25}},
  C:{open:.45,round:0,wide:.65,hiss:0,visemes:{AA_VI_11_E:.8}},
  D:{open:.8,round:0,wide:.15,hiss:0,visemes:{AA_VI_10_aa:.9}},
  E:{open:.42,round:.65,wide:0,hiss:0,visemes:{AA_VI_13_O:.8}},
  F:{open:.25,round:1,wide:0,hiss:0,visemes:{AA_VI_14_U:.95}},
  G:{open:.1,round:0,wide:.15,hiss:.2,visemes:{AA_VI_02_FF:.85}},
  H:{open:.3,round:0,wide:.25,hiss:0,visemes:{AA_VI_04_DD:.8}},
});
export function validateLipTrack(track){
  if(!track||track.schemaVersion!==1||!Number.isFinite(track.durationMs)||track.durationMs<1||track.durationMs>180000||!Array.isArray(track.cues)||!track.cues.length||track.cues.length>15000)throw new Error('Invalid audio-aligned mouth track.');
  let end=0;for(const cue of track.cues){if(!Object.hasOwn(LIP_SHAPES,cue.value)||!Number.isFinite(cue.startMs)||!Number.isFinite(cue.endMs)||cue.startMs<end-.5||cue.endMs<=cue.startMs||cue.endMs>track.durationMs+25)throw new Error('Invalid mouth-cue timing.');end=cue.endMs;}
  return track;
}
export function lipSample(track,timeMs,{playing=true}={}){
  if(!track||!playing||timeMs<0||timeMs>=track.durationMs)return {...LIP_SHAPES.X,visemes:{}};
  let left=0,right=track.cues.length-1,index=-1;
  while(left<=right){const middle=(left+right)>>1,cue=track.cues[middle];if(timeMs<cue.startMs)right=middle-1;else if(timeMs>=cue.endMs)left=middle+1;else{index=middle;break;}}
  if(index<0)return {...LIP_SHAPES.X,visemes:{}};
  const cue=track.cues[index],shape=LIP_SHAPES[cue.value];
  // Closed lips and silence win immediately; blend the entrance to open shapes.
  if(cue.value==='A'||cue.value==='X')return {...shape,visemes:{...shape.visemes}};
  const previous=index?LIP_SHAPES[track.cues[index-1].value]:LIP_SHAPES.X,blend=Math.min(1,Math.max(0,(timeMs-cue.startMs)/35)),result={visemes:{}};
  for(const key of ['open','round','wide','hiss'])result[key]=previous[key]+(shape[key]-previous[key])*blend;
  for(const key of new Set([...Object.keys(previous.visemes),...Object.keys(shape.visemes)]))result.visemes[key]=(previous.visemes[key]||0)+((shape.visemes[key]||0)-(previous.visemes[key]||0))*blend;
  return result;
}
