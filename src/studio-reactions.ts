import {vocalReactionEvents,type VocalReactionEvent} from '../shared/studio/vocal-reactions.mjs';
export class StudioReactions{
 private buffers=new Map<string,AudioBuffer>();private pending=new Map<string,Promise<AudioBuffer|null>>();private active=new Set<AudioBufferSourceNode>();private seen=new Set<string>();private previous:number|null=null;
 constructor(private context:AudioContext,private mix:MediaStreamAudioDestinationNode){}
 async load(path:string,context:BaseAudioContext=this.context){if(this.buffers.has(path))return this.buffers.get(path)!;if(this.pending.has(path))return this.pending.get(path)!;const promise=fetch(path).then(async response=>response.ok?context.decodeAudioData(await response.arrayBuffer()):null).then(buffer=>{if(buffer)this.buffers.set(path,buffer);return buffer;}).catch(()=>null).finally(()=>this.pending.delete(path));this.pending.set(path,promise);return promise;}
 async unlock(){await Promise.all(['male-1','male-2','female-1','female-2'].flatMap(pack=>['chuckle','sigh'].flatMap(kind=>[1,2].map(variant=>this.load(`/audio/reactions/${pack}-${kind}-${variant}.ogg`)))));}
 stop(){for(const source of this.active){try{source.stop();}catch{}source.disconnect();}this.active.clear();delete document.body.dataset.studioVocalReactions;}
 tick(frame:{playing:boolean;programmeTimeMs?:number;timeMs:number},lines:Parameters<typeof vocalReactionEvents>[0],muted:boolean){
  const time=frame.programmeTimeMs??frame.timeMs;
  if(this.previous!==null&&(time<this.previous-150||time>this.previous+1500)){this.stop();this.seen.clear();}
  this.previous=time;if(!frame.playing||muted){this.stop();return;}
  const playing:string[]=[];
  for(const event of vocalReactionEvents(lines)){if(time<event.startMs||time>=event.startMs+event.durationMs)continue;playing.push(event.characterId+':'+event.kind);if(this.seen.has(event.id))continue;this.seen.add(event.id);const buffer=this.buffers.get(event.path);if(!buffer)continue;this.play(event,buffer,(time-event.startMs)/1000);}
  document.body.dataset.studioVocalReactions=playing.join(',');
 }
 private play(event:VocalReactionEvent,buffer:AudioBuffer,offset:number){const remaining=Math.min(buffer.duration,event.durationMs/1000)-offset;if(remaining<=.01)return;const source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner();source.buffer=buffer;source.connect(gain);gain.connect(pan);pan.pan.value=event.pan;pan.connect(this.context.destination);pan.connect(this.mix);const at=this.context.currentTime;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(event.gain,at+Math.min(.035,remaining/3));gain.gain.setValueAtTime(event.gain,at+Math.max(.035,remaining-.15));gain.gain.linearRampToValueAtTime(0,at+remaining);source.start(at,offset,remaining);this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};}
}
