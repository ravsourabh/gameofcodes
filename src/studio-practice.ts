export const PRACTICE=[
 {title:'Look and select',body:'Desktop: drag to look. In VR: point at a control and pinch. Your head always controls the headset view.',action:'cast',event:'cast'},
 {title:'Meet the cast',body:'Select a saved character to inspect them, or preview a new one. Accept once to keep the person for later shows.',action:'cast',event:'inspect'},
 {title:'Your premise',body:'Write or narrate a short premise. Review your words before confirming. Scripts are optional.',action:'write-premise',event:'capture'},
 {title:'Pause and recover',body:'Pause stops speech and screen playback. Resume or restart only when you choose.',action:'pause',event:'pause'},
 {title:'Direct the camera',body:'Automatic coverage follows the actual speaker. Try a wide or reaction shot. VR head movement stays yours.',action:'camera',event:'shot'},
 {title:'Keep a take',body:'Prepare a short show, then save a take. Original lines and recordings stay available when you make a retake.',action:'takes',event:'saved-take'},
 {title:'Try an edit',body:'In Takes, select a line, trim its ends, change its order or choose a shot. Save a new version; return to the previous one to undo.',action:'takes',event:'edit'},
 {title:'Make a video',body:'Choose a saved take, then record horizontal or vertical. Captions, saved voices and the room appear in the result; studio controls stay outside it.',action:'takes',event:'record'},
];
export class StudioPractice{
  active=false;index=0;length:5|10=5;started=0;
  start(length:5|10){this.active=true;this.index=0;this.length=length;this.started=Date.now();}
  get step(){return PRACTICE[this.index];}get count(){return this.length===5?6:8;}
  record(event:string){if(this.active&&this.step?.event===event){this.index++;if(this.index>=this.count)this.active=false;}}
  skip(){this.index++;if(this.index>=this.count)this.active=false;}
}
