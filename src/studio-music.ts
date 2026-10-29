import {StudioReactions} from './studio-reactions';
import type {StudioTurn} from '../shared/studio/index.mjs';
// News Theme by Kevin MacLeod (incompetech.com), CC BY 4.0.
// Short excerpts, fades and reduced level beneath dialogue.
import {soundtrackGain} from '../shared/studio/soundtrack.mjs';
export class StudioMusic{
  private reactions:StudioReactions;
  enabled=localStorage.getItem('studio-music')!=='off';vocalsEnabled=localStorage.getItem('studio-character-vocals')!=='off';audienceEnabled=localStorage.getItem('studio-audience')!=='off';
  private laughter:AudioBuffer|null=null;private laughSource:AudioBufferSourceNode|null=null;private laughed=new Set<string>();private laughGain:GainNode;private buffer:AudioBuffer|null=null;private pending:Promise<void>|null=null;private source:AudioBufferSourceNode|null=null;private gain:GainNode;private cue='';private started=0;private offset=0;
  constructor(private context:AudioContext,mix:MediaStreamAudioDestinationNode){this.reactions=new StudioReactions(context,mix);this.laughGain=context.createGain();this.laughGain.gain.value=.32;this.laughGain.connect(context.destination);this.laughGain.connect(mix);this.gain=context.createGain();this.gain.gain.value=0;this.gain.connect(context.destination);this.gain.connect(mix);}
  async unlock(){await this.context.resume();await this.reactions.unlock();if(!this.pending)this.pending=fetch('/audio/news-theme.mp3').then(response=>{if(!response.ok)throw new Error('Music unavailable');return response.arrayBuffer();}).then(bytes=>this.context.decodeAudioData(bytes)).then(buffer=>{this.buffer=buffer;}).catch(()=>{this.pending=null;});await this.pending;if(!this.laughter)try{const response=await fetch('/audio/audience-giggle.ogg');if(response.ok)this.laughter=await this.context.decodeAudioData(await response.arrayBuffer());}catch{}}
  toggleVocals(){this.vocalsEnabled=!this.vocalsEnabled;localStorage.setItem('studio-character-vocals',this.vocalsEnabled?'on':'off');if(!this.vocalsEnabled)this.reactions.stop();}
  toggleAudience(){this.audienceEnabled=!this.audienceEnabled;localStorage.setItem('studio-audience',this.audienceEnabled?'on':'off');if(!this.audienceEnabled){try{this.laughSource?.stop();}catch{}this.laughSource=null;}}
  toggle(){this.enabled=!this.enabled;localStorage.setItem('studio-music',this.enabled?'on':'off');if(!this.enabled)this.stop(false);else void this.unlock();}
  stop(includeReactions=true){if(includeReactions)this.reactions.stop();try{this.source?.stop();}catch{}this.source?.disconnect();this.source=null;this.cue='';this.gain.gain.cancelScheduledValues(this.context.currentTime);this.gain.gain.value=0;document.body.dataset.studioMusic='off';document.body.dataset.studioMusicGain='0';}
  tick(frame:{playing:boolean;timeMs:number;turnId?:string|null;audience?:boolean;programmeTimeMs?:number;outro?:boolean;outroProgress?:number;cueLines?:any[]},turns:StudioTurn[],muted:boolean){
    this.reactions.tick(frame,frame.cueLines||turns,muted||!this.vocalsEnabled||!turns.some(turn=>turn.id===frame.turnId));
    const line=turns.find(turn=>turn.id===frame.turnId),local=frame.timeMs-(line?.startMs||0),programmeTimeMs=frame.programmeTimeMs??frame.timeMs,opening=programmeTimeMs<6500;
    if(!frame.playing||muted){try{this.laughSource?.stop();}catch{}this.laughSource=null;}
    if(line&&local<100)this.laughed.delete(line.id);
    if(frame.playing&&!muted&&this.audienceEnabled&&frame.audience&&line&&this.laughter&&!this.laughed.has(line.id)){
      this.laughed.add(line.id);const source=this.context.createBufferSource();source.buffer=this.laughter;source.connect(this.laughGain);source.start(0,0,Math.min(1.65,this.laughter.duration));this.laughSource=source;
      this.laughGain.gain.cancelScheduledValues(this.context.currentTime);this.laughGain.gain.setValueAtTime(0,this.context.currentTime);this.laughGain.gain.linearRampToValueAtTime(.32,this.context.currentTime+.12);this.laughGain.gain.setTargetAtTime(0,this.context.currentTime+1.25,.13);
    }
    if(!this.enabled||muted||!frame.playing||!this.buffer||!line){if(this.source)this.stop(false);return;}
    const key='show',offset=Math.max(0,frame.programmeTimeMs??frame.timeMs)/1000%this.buffer.duration;
    if(this.cue!==key||Math.abs(this.offset+(this.context.currentTime-this.started)-offset)>.5){this.stop(false);const source=this.context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.gain);source.start(0,offset);this.source=source;this.cue=key;this.started=this.context.currentTime;this.offset=offset;}
    const level=soundtrackGain({...frame,programmeTimeMs});
    this.gain.gain.setTargetAtTime(level,this.context.currentTime,.12);document.body.dataset.studioMusic=frame.outro?'outro':opening?'intro':'bed';document.body.dataset.studioMusicGain=String(level);
  }
}
