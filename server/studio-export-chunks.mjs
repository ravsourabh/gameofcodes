import path from 'node:path';import {createHash} from 'node:crypto';
import {editionTimeline} from '../shared/studio/edition.mjs';
export const EXPORT_CHUNK_MS=20000;
export const programmeDuration=take=>editionTimeline(take).reduce((sum,line)=>sum+line.durationMs+(line.pauseAfterMs||0),0);
export function inspectProgramme(bytes,{width,height,durationMs}){
 const fail=message=>{throw new Error(message);};
 if(bytes.length<44||bytes.subarray(0,4).toString()!=='GOC1')fail('Use a complete fixed-frame programme chunk.');
 const videoSize=bytes.readUInt32LE(4),audioSize=bytes.readUInt32LE(8);if(videoSize<32||audioSize<44||12+videoSize+audioSize!==bytes.length)fail('Incomplete programme tracks.');
 const video=bytes.subarray(12,12+videoSize),audio=bytes.subarray(12+videoSize),frames=Math.ceil(durationMs*24/1000);
 if(video.subarray(0,4).toString()!=='DKIF'||video.subarray(8,12).toString()!=='VP80'||video.readUInt16LE(12)!==width||video.readUInt16LE(14)!==height||video.readUInt32LE(16)!==24||video.readUInt32LE(20)!==1||video.readUInt32LE(24)!==frames||audio.subarray(0,4).toString()!=='RIFF'||audio.subarray(8,12).toString()!=='WAVE'||audio.readUInt16LE(20)!==1||audio.readUInt16LE(22)!==2||audio.readUInt32LE(24)!==48000||audio.readUInt16LE(34)!==16||Math.abs((audio.length-44)/192-durationMs)>1)fail('Programme tracks do not match the saved chunk.');
 let offset=32;for(let frame=0;frame<frames;frame++){if(offset+12>video.length||video.readBigUInt64LE(offset+4)!==BigInt(frame))fail('Programme frames are incomplete or out of order.');offset+=12+video.readUInt32LE(offset);}if(offset!==video.length)fail('Programme frame data is incomplete.');return {video,audio,frames};
}
export function createExportChunks({folder,save,get,active,encode,fail}){
 async function chunk(profile,id,index,bytes){
  const job=await get(profile,id,true),duration=programmeDuration(job.take),count=Math.ceil(duration/EXPORT_CHUNK_MS);
  if(!Number.isSafeInteger(index)||index<0||index>=count)fail('Choose a valid export chunk.');
  const hash=createHash('sha256').update(bytes).digest('hex'),prior=job.chunks?.find(item=>item.index===index);
  if(prior){if(prior.hash!==hash)fail('This chunk already contains different frames. Create a new export.',409);return job;}
  if(job.status==='completed'||active.has(id))fail('This export is already processing.',409);
  if(bytes.length>20000000)fail('Upload smaller export chunks.',413);
  const startMs=index*EXPORT_CHUNK_MS,durationMs=Math.min(EXPORT_CHUNK_MS,duration-startMs);let tracks;
  try{tracks=inspectProgramme(bytes,{width:job.format==='vertical'?720:1280,height:job.format==='vertical'?1280:720,durationMs});}catch(error){fail(error.message);}
  const dir=await folder(profile,'exports'),stem=id+'.part-'+String(index).padStart(6,'0');active.add(id);
  try{await save(path.join(dir,stem+'.ivf'),tracks.video);await save(path.join(dir,stem+'.wav'),tracks.audio);job.chunks=[...(job.chunks||[]),{index,hash,durationMs,frames:tracks.frames}].sort((a,b)=>a.index-b.index);job.chunked=true;job.chunkCount=count;await save(path.join(dir,id+'.json'),JSON.stringify(job));return job;}finally{active.delete(id);}
 }
 async function finish(profile,id){const job=await get(profile,id,true);if(job.status==='completed'||active.has(id))return job;
  const count=Math.ceil(programmeDuration(job.take)/EXPORT_CHUNK_MS);if(!job.chunked||job.chunks?.length!==count||job.chunks.some((item,index)=>item.index!==index))fail('Some video chunks are missing. Record the saved take again, then delete this incomplete export.',409);
  const dir=await folder(profile,'exports'),list=extension=>'ffconcat version 1.0\n'+job.chunks.map(item=>`file '${id}.part-${String(item.index).padStart(6,'0')}.${extension}'`).join('\n')+'\n';
  await save(path.join(dir,id+'.video.txt'),list('ivf'));await save(path.join(dir,id+'.audio.txt'),list('wav'));return encode(profile,id);
 }
 return {chunk,finish};
}
