import {mkdir,readFile,writeFile,lstat,access} from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
import {replaceFile} from './atomic-file.mjs';import {isId,SessionError} from '../shared/session-domain.mjs';import {validateLipTrack} from '../shared/studio/lips.mjs';import {sarvamVoice,V3_MODEL,V4_MODEL,V3_VOICES,V4_VOICES} from '../shared/studio/voices.mjs';
import {studioSpeechDelivery} from './studio-prosody.mjs';
const fail=(message,status=503,code='SPEECH_UNAVAILABLE')=>{throw new SessionError(message,status,code);};
export function wavInfo(bytes){
  if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('Expected a WAV recording.');
  let format,data;for(let offset=12;offset+8<=bytes.length;){const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),end=Math.min(bytes.length,offset+8+size);if(id==='fmt '&&end-offset>=24)format={type:bytes.readUInt16LE(offset+8),channels:bytes.readUInt16LE(offset+10),rate:bytes.readUInt32LE(offset+12),bits:bytes.readUInt16LE(offset+22)};if(id==='data')data=bytes.subarray(offset+8,end);offset=end+(size%2);}
  if(!format||!data||format.type!==1||format.channels!==1||format.bits!==16||format.rate!==24000||!data.length)throw new Error('Use mono 24 kHz PCM16 audio for lip alignment.');
  const durationMs=data.length/(format.rate*2)*1000;if(durationMs<20||durationMs>180000)throw new Error('The speech recording is outside its duration limit.');return {durationMs,format};
}
function processOutput(command,args,{signal,input,maxBytes=6000000,timeout=60000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']}),chunks=[];let bytes=0,settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>{child.kill();finish(new SessionError('Speech preparation was interrupted.',409,'INTERRUPTED'));};
    const timer=setTimeout(()=>{child.kill();finish(new Error('The local audio tool timed out.'));},timeout);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    child.once('error',error=>finish(error));child.stdout.on('data',data=>{bytes+=data.length;if(bytes>maxBytes){child.kill();finish(new Error('Audio tool output is too large.'));}else chunks.push(data);});child.stderr.resume();child.stdin.on('error',()=>{});
    child.once('close',code=>finish(code===0?null:new Error('The local audio tool could not prepare this recording.'),Buffer.concat(chunks)));child.stdin.end(input);
  });
}
function pcmWave(data){
  // Rhubarb needs real RIFF/data lengths. ffmpeg's pipe output uses unknown
  // lengths, which some WAV readers interpret as an empty combined recording.
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);return Buffer.concat([header,data]);
}
export function createStudioSpeech({root,ai,env=process.env,align,now=()=>new Date().toISOString()}){
  const base=path.resolve(root),inflight=new Map();let queued=0;
  const aligner=env.RHUBARB_PATH||path.join(base,'.sovereign/tools/rhubarb',`Rhubarb-Lip-Sync-1.14.0-${process.platform==='win32'?'Windows':'Linux'}`,process.platform==='win32'?'rhubarb.exe':'rhubarb');
  async function folder(profileId,create=false){
    if(!isId(profileId))fail('Invalid speech profile.',400);const paths=[base];for(const part of ['.sovereign','studio','v1',profileId,'audio'])paths.push(path.join(paths.at(-1),part));
    for(const p of paths){let info;try{info=await lstat(p);}catch(error){if(error.code!=='ENOENT')throw error;if(!create)return null;try{await mkdir(p);}catch(error){if(error.code!=='EEXIST')throw error;}info=await lstat(p);}if(info.isSymbolicLink()||!info.isDirectory())fail('Audio storage cannot be redirected.',409,'STORAGE_CONFLICT');}return paths.at(-1);
  }
  async function read(file,max){try{const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile()||info.size>max)fail('This saved audio asset cannot be read safely.',409,'INVALID_AUDIO');return readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
  async function save(file,data){try{const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())fail('The audio target is unavailable.',409);}catch(error){if(error.code!=='ENOENT')throw error;}const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,data,{flag:'wx'});await replaceFile(temporary,file);}
  async function get(profileId,key){
    if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('Invalid speech asset.',400);const dir=await folder(profileId);if(!dir)return null;const saved=await read(path.join(dir,key+'.json'),1500000);if(!saved)return null;
    let asset;try{asset=JSON.parse(saved.toString());validateLipTrack(asset.lips);}catch{fail('Saved lip alignment is inconsistent. It has not been changed.',409,'INVALID_AUDIO');}
    const bytes=await read(path.join(dir,key+'.wav'),6000000);if(!bytes||asset.profileId!==profileId||asset.id!==key||asset.schemaVersion!==1||createHash('sha256').update(bytes).digest('hex')!==asset.audioHash)fail('The audio and mouth alignment do not match.',409,'INVALID_AUDIO');
    return {...asset,audio:bytes.toString('base64')};
  }
  async function prepare(profileId,character,text,language,signal,direction={}){
    if(typeof text!=='string'||!text.trim()||text.length>2500)fail('Use a bounded spoken line.',400);
    if(!character.voice)fail('Choose a voice for this character, or continue with captions.',409);
    if(character.voice.provider==='browser')fail('Device speech cannot supply a stable final-audio alignment. Choose a connected voice or captions.',409);
    if(character.voice.provider==='sarvam')try{sarvamVoice(character.voice,language.primary);}catch(error){fail(error.message,400);}
    const speechDelivery=character.voice.provider==='sarvam'?studioSpeechDelivery(text,language,direction.intent):null;
    const voice={...character.voice,...(character.voice.provider==='sarvam'?{model:character.voice.model||V3_MODEL}:{})},key=createHash('sha256').update(JSON.stringify({version:1,characterId:character.id,text,voice,preference:character.voicePreference||null,language,alignment:'rhubarb-1.14.0-phonetic',...(speechDelivery?{speechDelivery}:{})})).digest('hex');
    const previous=await get(profileId,key);if(previous)return previous;
    if(inflight.has(profileId+'/'+key))return inflight.get(profileId+'/'+key);if(queued>=3)fail('Speech preparation is busy. Pause and retry shortly.',429);
    const work=(async()=>{queued++;try{
      if(!align)try{await access(aligner);}catch{fail('The final-audio lip aligner is not installed. Run npm run setup:lips, or use captions.',503,'ALIGNER_UNAVAILABLE');}
      const dir=await folder(profileId,true),audioPath=path.join(dir,key+'.wav');let bytes=await read(audioPath,6000000);
      if(!bytes){
        const parts=[];for(const segment of speechDelivery?.segments||[text]){const speech=await ai.speak(profileId,{...character,voice},segment,signal,language.primary,speechDelivery),source=Buffer.from(speech.audio,'base64');let pcm;try{wavInfo(source);pcm=source;}catch{pcm=await processOutput(env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0','-ar','24000','-ac','1','-c:a','pcm_s16le','-f','wav','pipe:1'],{input:source,signal});wavInfo(pcm);}parts.push(pcm);}
        if(parts.length===1)bytes=parts[0];else{
          // Decode the actual audio, join once, then align the final recording.
          const decoded=[];for(const [index,part]of parts.entries()){if(index)decoded.push(Buffer.alloc(Math.round(24000*(speechDelivery.pauseMs/1000))*2));decoded.push(await processOutput(env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0','-f','s16le','-acodec','pcm_s16le','pipe:1'],{input:part,signal}));}
          bytes=pcmWave(Buffer.concat(decoded));wavInfo(bytes);
        }
        if(signal?.aborted)fail('Speech was interrupted.',409,'INTERRUPTED');await save(audioPath,bytes);
      }
      const info=wavInfo(bytes);let result;
      if(align)result=await align({bytes,text,signal});else{const raw=await processOutput(aligner,['-r','phonetic','--extendedShapes','GHX','-f','json','--machineReadable',audioPath],{signal,maxBytes:1500000});try{result=JSON.parse(raw.toString());}catch{fail('The audio aligner returned unreadable timing.',502);}}
      const lips=validateLipTrack({schemaVersion:1,engine:'rhubarb-1.14.0-phonetic',durationMs:info.durationMs,cues:result.mouthCues.filter(cue=>cue.end>cue.start).map(cue=>({value:cue.value,startMs:Math.round(cue.start*1000),endMs:Math.min(info.durationMs,Math.round(cue.end*1000))})).filter(cue=>cue.endMs>cue.startMs)});
      if(signal?.aborted)fail('Speech was interrupted.',409,'INTERRUPTED');const asset={schemaVersion:1,id:key,profileId,characterId:character.id,text,voice,language,...(speechDelivery?{speechDelivery}:{}),createdAt:now(),mime:'audio/wav',durationMs:info.durationMs,audioHash:createHash('sha256').update(bytes).digest('hex'),lips};await save(path.join(dir,key+'.json'),JSON.stringify(asset));return {...asset,audio:bytes.toString('base64')};
    }finally{queued--;inflight.delete(profileId+'/'+key);}})();inflight.set(profileId+'/'+key,work);return work;
  }
  async function capabilities(){let available=!!align;try{await access(aligner);available=true;}catch{}return {schemaVersion:1,models:[{id:V4_MODEL,name:'V4 Flash',voices:V4_VOICES},{id:V3_MODEL,name:'V3 · explicit alternative',voices:V3_VOICES}],sarvamConfigured:!!env.SARVAM_API_KEY,alignment:{engine:'rhubarb-1.14.0-phonetic',available},deviceSpeechAligned:false};}
  return {prepare,get,capabilities};
}
