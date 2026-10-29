import * as THREE from 'three';
import {validateScreenSourceUrl} from '../shared/studio/screen-source.mjs';
export async function downloadScreenMedia(value:string,kind:'gif'|'video'){
 validateScreenSourceUrl(value);const response=await fetch(value,{credentials:'omit',signal:AbortSignal.timeout(30000)});
 if(!response.ok||!response.body)throw new Error('The direct media link could not download. Use a direct GIF, MP4 or WebM link.');
 const limit=kind==='gif'?16000000:80000000,reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw new Error('Choose a GIF under 16 MB or video under 80 MB.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const type=(response.headers.get('content-type')||'').split(';')[0].trim(),url=new URL(value),mime=type==='image/gif'?'image/gif':['video/mp4','video/webm'].includes(type)?type:kind==='gif'?'image/gif':/\.webm$/i.test(url.pathname)?'video/webm':'video/mp4';
 return new File([bytes.buffer],url.pathname.split('/').pop()||'screen-clip',{type:mime});
}
type Decoder={tracks:{ready:Promise<void>;selectedTrack:{frameCount:number}};decode:(options:{frameIndex:number})=>Promise<{image:VideoFrame}>;close:()=>void};
export class StudioScreen{
  readonly canvas=document.createElement('canvas');readonly texture=new THREE.CanvasTexture(this.canvas);
  kind:'none'|'gif'|'video'='none';name='Choose a GIF or video';playing=false;muted=true;local=false;frame=0;
  private video:HTMLVideoElement|null=null;private decoder:Decoder|null=null;private objectUrl='';private token=0;private pending=false;private next=0;private index=0;private lastVideoTime=-1;private context:CanvasRenderingContext2D;
  private gifDurations:number[]=[];private exportMode=false;
  private shouldPlay=true;
  private idleArtwork=new Image();
  private audioSource:MediaElementAudioSourceNode|null=null;private audioGain:GainNode|null=null;
  connectAudio(context:AudioContext,destination:AudioNode){if(!this.video)return;if(!this.audioSource){this.audioSource=context.createMediaElementSource(this.video);this.audioGain=context.createGain();this.audioSource.connect(this.audioGain);this.audioGain.connect(context.destination);this.audioGain.connect(destination);}this.audioGain!.gain.value=this.muted?0:1;}
  settings(muted:boolean,loop:boolean,startMs:number){this.muted=muted;if(this.video){this.video.muted=muted;this.video.loop=loop;this.video.currentTime=Math.min(startMs/1000,this.video.duration||0);}if(this.audioGain)this.audioGain.gain.value=muted?0:1;}
  constructor(private changed:()=>void){this.canvas.width=1280;this.canvas.height=720;this.context=this.canvas.getContext('2d')!;this.texture.colorSpace=THREE.SRGBColorSpace;this.idleArtwork.onload=()=>{if(this.kind==='none')this.blank();};this.idleArtwork.src='/branding/baat-ka-bawaal/logo.png';this.blank();}
  private blank(){const gradient=this.context.createLinearGradient(0,0,1280,720);gradient.addColorStop(0,'#102a42');gradient.addColorStop(1,'#080f1b');this.context.fillStyle=gradient;this.context.fillRect(0,0,1280,720);this.context.strokeStyle='#355b7370';this.context.lineWidth=3;for(let x=-200;x<1600;x+=180){this.context.beginPath();this.context.moveTo(x,0);this.context.lineTo(x+350,720);this.context.stroke();}if(this.idleArtwork.complete&&this.idleArtwork.naturalWidth)this.context.drawImage(this.idleArtwork,115,97,1050,525);this.texture.needsUpdate=true;}
  clear(){this.gifDurations=[];this.exportMode=false;this.token++;this.video?.pause();this.audioSource?.disconnect();this.audioGain?.disconnect();this.audioSource=null;this.audioGain=null;if(this.video){this.video.removeAttribute('src');this.video.load();}this.video=null;this.decoder?.close();this.decoder=null;if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl='';this.kind='none';this.playing=false;this.shouldPlay=true;this.lastVideoTime=-1;this.frame=0;this.pending=false;this.index=0;this.next=0;this.name='Choose a GIF or video';this.blank();this.changed();}
  async file(file:File){if(!/^(video\/(mp4|webm)|image\/gif)$/.test(file.type)||file.size>80000000)throw new Error('Choose a GIF, MP4 or WebM smaller than 80 MB.');this.clear();this.local=true;this.name=file.name;const token=this.token;if(file.type==='image/gif'){if(file.size>16000000)throw new Error('Choose a GIF smaller than 16 MB.');await this.gif(await file.arrayBuffer(),token);}else{this.objectUrl=URL.createObjectURL(file);await this.loadVideo(this.objectUrl,token);}this.changed();}
  async url(value:string,kind:'gif'|'video'){
    const url=new URL(value);if(url.protocol!=='https:'&&url.origin!==location.origin||url.username||url.password)throw new Error('Use a direct HTTPS media link without credentials.');this.clear();this.local=false;this.name=url.pathname.split('/').pop()||url.hostname;const token=this.token;
    if(kind==='gif'){const response=await fetch(url.href,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw new Error('The GIF could not load. Try a local file.');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000000){await reader.cancel();throw new Error('Choose a GIF smaller than 16 MB.');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}await this.gif(bytes.buffer,token);}else await this.loadVideo(url.href,token);this.changed();
  }
  private async gif(data:ArrayBuffer,token:number){
    const Constructor=(window as unknown as {ImageDecoder?:new(options:{data:ArrayBuffer;type:string})=>Decoder}).ImageDecoder;if(!Constructor)throw new Error('Animated GIF decoding is unavailable in this browser. Use MP4 or WebM.');
    if(token!==this.token)return;const decoder=new Constructor({data,type:'image/gif'});this.decoder=decoder;await decoder.tracks.ready;if(token!==this.token)return;this.kind='gif';this.playing=this.shouldPlay;await this.decode(performance.now(),token);
  }
  private async loadVideo(url:string,token:number){
    const video=document.createElement('video');video.crossOrigin='anonymous';video.playsInline=true;video.loop=true;video.muted=true;video.preload='auto';this.video=video;
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video loading timed out. Try a local file.')),15000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('This video or its cross-origin access is unsupported. Try a local MP4/WebM.'));};video.src=url;});
    if(token!==this.token)return;if(video.videoWidth*video.videoHeight>16000000)throw new Error('Choose video up to 4K resolution.');this.kind='video';this.muted=true;if(this.shouldPlay){await video.play();this.playing=true;}else this.playing=false;
  }
  private draw(image:CanvasImageSource,width:number,height:number){this.context.fillStyle='#000';this.context.fillRect(0,0,1280,720);const scale=Math.min(1280/width,720/height),w=width*scale,h=height*scale;this.context.drawImage(image,(1280-w)/2,(720-h)/2,w,h);this.texture.needsUpdate=true;this.frame++;}
  private async decode(now:number,token:number){const decoder=this.decoder;if(!decoder||this.pending)return;this.pending=true;try{const {image}=await decoder.decode({frameIndex:this.index});if(token===this.token&&this.playing){this.draw(image,image.displayWidth,image.displayHeight);this.next=now+Math.max(20,(image.duration||100000)/1000);this.index=(this.index+1)%decoder.tracks.selectedTrack.frameCount;}image.close();}catch{if(token===this.token){this.playing=false;this.name='GIF decoding stopped. Choose another file.';this.changed();}}finally{if(token===this.token)this.pending=false;}}
  tick(now:number){if(this.exportMode)return;if(this.kind==='video'&&this.video&&this.video.readyState>=2){if(this.video.currentTime!==this.lastVideoTime){this.draw(this.video,this.video.videoWidth,this.video.videoHeight);this.lastVideoTime=this.video.currentTime;}}else if(this.kind==='gif'&&this.playing&&now>=this.next)void this.decode(now,this.token);document.body.dataset.studioScreen=JSON.stringify({kind:this.kind,playing:this.playing,muted:this.muted,frame:this.frame,time:this.video?.currentTime||0,local:this.local,aiInput:false});}
  async exportAt(timeMs:number,startMs=0,loop=true){this.exportMode=true;this.video?.pause();this.playing=false;
    if(this.video){const video=this.video,time=(timeMs+startMs)/1000,target=loop?time%video.duration:Math.min(time,Math.max(0,video.duration-.001));if(Math.abs(video.currentTime-target)>.0001)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('The screen video could not seek for export.'));},10000),cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);},done=()=>{cleanup();resolve();};video.addEventListener('seeked',done);video.currentTime=target;});this.draw(video,video.videoWidth,video.videoHeight);}
    else if(this.decoder){if(!this.gifDurations.length)for(let i=0;i<this.decoder.tracks.selectedTrack.frameCount;i++){const {image}=await this.decoder.decode({frameIndex:i});this.gifDurations.push(Math.max(20,(image.duration||100000)/1000));image.close();}const total=this.gifDurations.reduce((a,b)=>a+b,0);let time=loop?(timeMs+startMs)%total:Math.min(timeMs+startMs,total-1),index=0;while(index<this.gifDurations.length-1&&time>=this.gifDurations[index])time-=this.gifDurations[index++];const {image}=await this.decoder.decode({frameIndex:index});this.draw(image,image.displayWidth,image.displayHeight);image.close();}
  }
  endExport(){this.exportMode=false;}
  async toggle(){if(this.kind==='none')return;this.shouldPlay=!this.playing;if(this.video){if(this.playing)this.video.pause();else await this.video.play();}this.playing=this.shouldPlay;this.next=0;this.changed();}
  mute(){if(this.video){this.video.muted=!this.video.muted;this.muted=this.video.muted;if(this.audioGain)this.audioGain.gain.value=this.muted?0:1;this.changed();}}
  seek(delta:number){if(this.video&&Number.isFinite(this.video.duration))this.video.currentTime=Math.max(0,Math.min(this.video.duration,this.video.currentTime+delta));}
  restart(){this.index=0;this.next=0;if(this.video)this.video.currentTime=0;this.changed();}
  pause(){this.shouldPlay=false;this.video?.pause();this.playing=false;this.changed();}
  dispose(){this.clear();this.texture.dispose();}
}
