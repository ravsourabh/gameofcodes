import {deliveryPause,deliveryClock,CLOSING_PAUSE_MS,deliveryAudience} from '../shared/studio/delivery.mjs';
import {lipSample} from '../shared/studio/lips.mjs';
import {activeTurns} from '../shared/studio/production.mjs';
import {StudioTimeline} from './studio-timeline';
import {defaultEdition,editionTimeline} from '../shared/studio/edition.mjs';
import type {EpisodeRecord,SpeechAsset,StudioTurn,StudioCharacter,Take} from '../shared/studio/index.mjs';
export class StudioPlayback{
  private inPause=false;private token=0;private request:AbortController|null=null;private audio:HTMLAudioElement|null=null;private objectUrl='';private playing=false;private replaying=false;
  private asset:SpeechAsset|null=null;private turn:StudioTurn|null=null;private captionAt=0;private captionTimer:ReturnType<typeof setTimeout>|null=null;private cancelLine:(()=>void)|null=null;
  active=false;captions=false;complete=false;preparingPhase:'writing'|'reviewing'|'revising'|'checking'|'staging'|null=null;private positionMs=0;
  private prepared:StudioTimeline|null=null;private cancelPrepared:(()=>void)|null=null;
  get isPlaying(){return this.playing;}
  constructor(private record:()=>EpisodeRecord|null,private call:(path:string,method?:string,input?:unknown,signal?:AbortSignal)=>Promise<any>,private update:(record:EpisodeRecord)=>void,private changed:(message?:string,error?:boolean)=>void){}
  frame(){if(this.prepared?.take){const frame=this.prepared.frame();return {...frame,timeMs:frame.sourceTimeMs};}const time=this.audio?this.audio.currentTime*1000:this.playing?Math.max(0,performance.now()-this.captionAt):this.positionMs,production=this.record()?.production,clock=deliveryClock(this.turn,time,{turns:production?activeTurns(production):[],enabled:!!production?.writer,durationMs:this.asset?.durationMs});return {speakerId:this.playing&&!this.inPause?this.turn?.characterId||null:null,turnId:this.turn?.id||null,timeMs:clock.sourceTimeMs,programmeTimeMs:clock.programmeTimeMs,outro:this.inPause&&this.turn?.intent==='closing',outroProgress:this.inPause?Math.max(0,Math.min(1,(clock.localMs-(this.turn?.durationMs||0))/CLOSING_PAUSE_MS)):0,audience:this.inPause&&deliveryAudience(this.turn||undefined),mouth:lipSample(this.asset?.lips||null,time,{playing:this.playing&&!this.captions&&!this.inPause}),playing:this.playing};}
  async control(operation:string,extra:Record<string,unknown>={},signal?:AbortSignal){const record=this.record();if(!record)throw new Error('Prepare an episode first.');const input={requestId:crypto.randomUUID(),expectedRevision:record.revision,expectedEpoch:record.epoch,operation,...extra},path=`episodes/${record.id}/production`;let result;try{result=await this.call(path,'POST',input,signal);}catch(error){if(signal?.aborted||typeof (error as {status?:number}).status==='number')throw error;result=await this.call(path,'POST',input,signal);}if(result.pending)result=await this.waitDetached(record.id,input.requestId,signal);this.update(result.episode);return result;}
  silence(){this.token++;this.request?.abort();this.request=null;this.inPause=false;this.playing=false;this.active=false;this.audio?.pause();this.prepared?.pause();this.cancelPrepared?.();this.cancelPrepared=null;if(this.captionTimer)clearTimeout(this.captionTimer);this.captionTimer=null;this.cancelLine?.();this.cancelLine=null;}
  async pause(){const positionMs=this.audio?Math.round(this.audio.currentTime*1000):this.playing?Math.round(performance.now()-this.captionAt):this.positionMs;this.positionMs=positionMs;this.silence();const record=this.record();if(!record?.production||this.replaying){this.replaying=false;this.changed('Playback paused.');return;}const fresh=await this.call(`episodes/${record.id}`);this.update(fresh.episode);if(fresh.episode.production.status==='running')await this.control('pause',{positionMs});this.changed('Paused. Saved contributions are kept.');}
  async start(captions=false){this.silence();this.captions=captions;this.replaying=false;await this.control('start',{prepareOnly:true,adaptive:true});void this.loop();}
  async continueConversation(){this.silence();this.replaying=false;this.complete=false;await this.control('continue');void this.loop();}
  async resume(captions=this.captions){this.captions=captions;if(this.record()?.production?.status!=='running')await this.control('resume');void this.loop();}
  seek(ms:number){if(this.prepared?.take){const line=this.prepared.frame().line;if(line)this.prepared.seek(line.startMs+ms-this.prepared.timeMs);return;}if(this.audio)this.audio.currentTime=Math.max(0,Math.min(ms/1000,this.audio.duration||0));}
  seekBy(ms:number){if(this.prepared?.take)this.prepared.seek(ms);else if(this.audio)this.seek(this.audio.currentTime*1000+ms);}
  private async line(turn:StudioTurn,asset:SpeechAsset|null,token:number,offset=0){
    if(this.prepared){void this.prepared.dispose();this.prepared=null;}
    if(token!==this.token)return;this.inPause=false;this.turn=turn;this.asset=asset;this.positionMs=offset;this.playing=true;this.changed(`${turn.characterSnapshot.name} · ${this.replaying?'Replay':turn.source==='model'?'Cast collaboration':'Authored line'}`);
    document.body.dataset.studioLine=turn.id;document.body.dataset.studioSpeaker=turn.characterId;
    if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.audio=null;
    const speechDuration=asset?.durationMs||turn.durationMs||Math.min(15000,Math.max(1200,turn.text.length*42));
    if(asset&&offset<speechDuration){const bytes=Uint8Array.from(atob(asset.audio),char=>char.charCodeAt(0));this.objectUrl=URL.createObjectURL(new Blob([bytes],{type:asset.mime}));const audio=new Audio(this.objectUrl);this.audio=audio;audio.muted=this.captions;audio.preload='auto';
      await new Promise<void>((resolve,reject)=>{let settled=false;const finish=(error?:Error)=>{if(settled)return;settled=true;this.cancelLine=null;audio.onended=null;audio.onerror=null;error?reject(error):resolve();};this.cancelLine=()=>finish();audio.onended=()=>finish();audio.onerror=()=>finish(new Error('The saved audio could not play. Retry or choose captions.'));audio.onloadedmetadata=()=>{audio.currentTime=Math.min(offset/1000,audio.duration);};void audio.play().catch(()=>finish(new Error('Tap Resume to allow the saved audio, or choose captions.')));});
    }else if(offset<speechDuration){const duration=speechDuration;this.captionAt=performance.now()-offset;await new Promise<void>(resolve=>{this.cancelLine=resolve;this.captionTimer=setTimeout(resolve,Math.max(0,duration-offset));});this.cancelLine=null;this.captionTimer=null;}
    if(token===this.token&&turn.id!=='audition'){
      const pause=deliveryPause(turn,{enabled:!!this.record()?.production?.writer});
      if(pause){const elapsedPause=Math.max(0,offset-speechDuration);this.positionMs=speechDuration+Math.min(pause,elapsedPause);this.audio=null;this.captionAt=performance.now()-this.positionMs;this.inPause=true;
        await new Promise<void>(resolve=>{this.cancelLine=resolve;this.captionTimer=setTimeout(resolve,Math.max(0,pause-elapsedPause));});this.cancelLine=null;this.captionTimer=null;this.inPause=false;}
    }
    this.positionMs=this.audio?this.audio.currentTime*1000:Math.max(this.positionMs,performance.now()-this.captionAt);this.playing=false;
  }
  private async waitDetached(episodeId:string,requestId:string,signal?:AbortSignal):Promise<any>{
    let temporaryFailures=0;for(;;){if(signal?.aborted)throw new DOMException('Preparation paused.','AbortError');let result;try{result=await this.call(`episodes/${episodeId}/production?requestId=${requestId}`,'GET',undefined,signal);temporaryFailures=0;}catch(error){if(!signal?.aborted&&(error as {code?:string}).code==='GATEWAY_RESPONSE'&&temporaryFailures++<3){await new Promise(resolve=>setTimeout(resolve,650));continue;}throw error;}if(result.error)throw Object.assign(new Error(result.error.message||'Scene preparation failed. Saved work is kept.'),{status:result.error.status,code:result.error.code});if(signal?.aborted)throw new DOMException('Preparation paused.','AbortError');if(!result.pending)return result;
      if(['writing','reviewing','revising','checking','staging'].includes(result.phase)&&this.preparingPhase!==result.phase){this.preparingPhase=result.phase;this.changed(({writing:'The writer is shaping the conversation…',reviewing:'The independent reviewer is checking the script…',revising:'The writer is improving the script from reviewer feedback…',checking:'Checking character identities and continuity…',staging:'The director is choosing shots and reactions…'} as Record<string,string>)[result.phase]);}
      await new Promise<void>((resolve,reject)=>{const finish=()=>{signal?.removeEventListener('abort',abort);resolve();},timer=setTimeout(finish,650),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Preparation paused.','AbortError'));};signal?.addEventListener('abort',abort,{once:true});});
    }
  }
  private async nextTurn(controller:AbortController,token:number){const record=this.record()!;this.preparingPhase=record.production?.writer?(record.production.writer.staging?null:'staging'):'writing';try{
    if(record.production?.flow){const active=await this.call(`episodes/${record.id}/production`,'GET',undefined,controller.signal);if(active.episode){this.update(active.episode);if(active.episode.production?.awaitingPlayback)return {episode:active.episode};}if(active.pending&&active.requestId){const result=await this.waitDetached(record.id,active.requestId,controller.signal);if(token===this.token)this.update(result.episode);return result;}}
    return await this.control('turn',record.production?.flow?{detached:true}:{},controller.signal);
  }finally{this.preparingPhase=null;}}
  private async loop(){const token=++this.token;this.active=true;const controller=new AbortController();this.request=controller;
    try{while(token===this.token){let record=this.record();if(!record?.production||record.production.status!=='running')break;if(record.production.phase==='voicing'){
          const lines=activeTurns(record.production);
          for(const [index,line] of lines.entries()){if(token!==this.token)break;if(!line.voiceAssetId&&!this.captions){this.changed(`Preparing voice ${index+1} of ${lines.length} · ${line.characterSnapshot.name}. Saved voices are kept if you pause.`);await this.control('voice',{turnId:line.id},controller.signal);}}
          if(token===this.token)await this.control('ready',{captions:this.captions},controller.signal);break;
        }
        const pending=record.production.awaitingPlayback;let turn=pending?record.production.turns.find(item=>item.id===pending):null;
        if(!turn){this.changed(record.production.writer?'Saving the next line from the written scene…':'The writer is shaping the conversation…');const result=await this.nextTurn(controller,token);if(token!==this.token)break;record=result.episode;turn=record!.production!.turns.find(item=>item.id===record!.production!.awaitingPlayback);}
        if(!turn)throw new Error('No saved line was returned.');if(record!.production!.phase==='composing'){await this.control('drafted',{turnId:turn.id},controller.signal);continue;}let asset:SpeechAsset|null=null;
        if(!this.captions){this.changed('Preparing the voice and matching mouth movements…');asset=(await this.control('voice',{turnId:turn.id},controller.signal)).asset;}
        if(token!==this.token)break;await this.line(turn,asset,token,this.record()?.production?.linePositionMs||0);if(token!==this.token)break;
        await this.control('played',{turnId:turn.id,captions:this.captions},controller.signal);
      }if(token===this.token)this.changed(this.record()?.production?.reason||'The show is paused.');
    }catch(error){if(token===this.token){this.playing=false;try{await this.pause();}catch{}this.changed(error instanceof Error?error.message:'The show paused. Saved lines are kept.',true);}}
    finally{if(token===this.token){this.active=false;this.playing=false;this.request=null;this.changed();}}
  }
  async replay(startId?:string,offset=0){this.silence();this.complete=false;this.replaying=true;const record=this.record(),token=++this.token;this.active=true;
    this.audio=null;
    if(this.prepared)void this.prepared.dispose();
    const prepared=new StudioTimeline(()=>{if(token!==this.token)return;this.playing=prepared.playing;if(!prepared.playing&&prepared.timeMs>=prepared.durationMs)this.cancelPrepared?.();this.changed();});this.prepared=prepared;
    try{
      if(!record?.production)throw new Error('Prepare a show first.');
      const production={...record.production,turns:record.production.turns.map(turn=>({...turn,durationMs:turn.durationMs||Math.min(15000,Math.max(1200,turn.text.length*42))}))},take={productionSnapshot:production} as Take;
      const lines=editionTimeline(take,defaultEdition(take)),start=lines.find(line=>line.id===startId),at=(start?.startMs||0)+offset;
      this.changed('Loading saved voices for continuous playback…');
      await prepared.load(take,async id=>{const asset=(await this.call('audio/'+id)).asset;if(token!==this.token)throw new DOMException('Playback cancelled.','AbortError');return asset;},undefined,{allowMissingVoices:this.captions});
      if(token!==this.token)return;prepared.setCaptions(this.captions);
      await new Promise<void>((resolve,reject)=>{this.cancelPrepared=resolve;void prepared.play(at).catch(reject);});
      if(token===this.token){this.complete=true;this.changed('Replay complete. No new generation was requested.');}
    }catch(error){if(token===this.token)this.changed(String((error as Error).message),true);}finally{if(token===this.token){prepared.pause();this.cancelPrepared=null;this.active=false;this.playing=false;this.replaying=false;this.changed();}}
  }
  async setCaptions(enabled:boolean){
    this.captions=enabled;
    if(this.active&&this.prepared?.playing){const missing=this.record()?.production&&activeTurns(this.record()!.production!).some(turn=>!turn.voiceAssetId);if(enabled||!missing){this.prepared.setCaptions(enabled);this.changed(enabled?'Captions only. Turn voices on whenever you like.':'Voices on.');return;}}
    if(this.active&&this.isPlaying&&this.audio){this.audio.muted=enabled;this.changed(enabled?'Captions only. Turn voices on whenever you like.':'Voices on.');return;}
    if(this.active&&this.record()?.production?.phase==='composing'){this.changed(enabled?'Captions only selected.':'Voices selected.');return;}
    if(enabled){if(this.active){this.changed('Captions only selected.');return;}if(this.record()?.production?.status==='completed')void this.replay();else if(this.record()?.production)await this.resume(true);else await this.start(true);return;}
    const frame=this.frame(),startId=frame.turnId||undefined,offset=this.turn?Math.max(0,frame.timeMs-this.turn.startMs):0;
    if(this.active)await this.pause();
    const production=this.record()?.production,missing=production&&activeTurns(production).some(turn=>!turn.voiceAssetId);
    if(missing){await this.control('prepare-voices');const preparing=this.loop(),token=this.token;void preparing.then(()=>{if(token===this.token&&!this.captions&&this.record()?.production?.status==='completed')void this.replay(startId,offset);});return;}
    if(!this.captions&&this.record()?.production?.status==='completed')void this.replay(startId,offset);
  }
  async audition(asset:SpeechAsset,actor:StudioCharacter){this.silence();const token=++this.token;this.captions=false;this.replaying=true;this.active=true;try{await this.line({id:'audition',characterId:actor.id,beatId:'audition',text:asset.text,source:'authored',brain:null,respondsTo:null,startMs:0,runId:'audition',characterSnapshot:actor},asset,token);}finally{if(token===this.token){this.active=false;this.playing=false;this.replaying=false;this.changed('Voice audition complete.');}}}
  dispose(){this.silence();if(this.prepared)void this.prepared.dispose();if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);}
}
