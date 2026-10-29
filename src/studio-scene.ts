import {motionDuration} from '../shared/studio/motion-library.mjs';
import {performanceTimelineCues,performanceTimeline} from '../shared/studio/written-performance.mjs';
import {attentionSample} from '../shared/studio/attention.mjs';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {XRHandModelFactory} from 'three/addons/webxr/XRHandModelFactory.js';
import {RealisticAvatar,realisticModelFor} from './realistic-avatar';
import {CourtSurface} from './court-surfaces';
import type {Character} from '../shared/session-domain.mjs';
import {performanceSample,performanceCatalogue,type ActiveAction} from '../shared/studio/performance.mjs';
import {PARTNER_ACTIONS,SEAT_SPACING} from '../shared/studio/stage-paths.mjs';
import {activeTurns} from '../shared/studio/production.mjs';
import type {EpisodeRecord} from '../shared/studio/index.mjs';
import type {Mouth} from './realistic-avatar';
import {cameraPose,openingCameraPose,closingCameraPose,automaticCoverage,timedCoverage,OPENING_DURATION_MS,type Shot} from './studio-camera';
import {StudioBranding} from './studio-branding';
import {StudioSet} from './studio-set';

export type StudioButton={label:string;action:string};
export class StudioScene{
  readonly renderer:THREE.WebGLRenderer;readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(48,1,.05,35);
  private origin=new THREE.Group();private ray=new THREE.Raycaster();private viewer=new THREE.Vector3();private avatars=new Map<string,{avatar:RealisticAvatar;signature:string}>();
  private menu=new CourtSurface('studio',2.5,1.55,[0,1.35,.25]);private keys=new CourtSurface('studio-keyboard',2.8,1.65,[0,1.25,.15]);
  private controllers:THREE.Group[]=[];private environment:THREE.Texture;private observer:ResizeObserver;private last=0;private frames=0;private yaw=0;private pitch=0;private disposed=false;
  private seating=new THREE.Group();private seatCount=-1;
  private branding=new StudioBranding();private brandingEnabled=true;private exportFrame=false;
  private studioSet=new StudioSet();
  private drag:{x:number;y:number;yaw:number;pitch:number;moved:boolean}|null=null;private desk=new THREE.Group();private editing=false;
  private episode:EpisodeRecord|null=null;private sample:()=>{speakerId:string|null;turnId?:string|null;programmeTimeMs?:number;cueLines?:any[];timeMs:number;mouth:Mouth;playing:boolean}=()=>({speakerId:null,timeMs:0,mouth:{open:0,round:0,wide:0,hiss:0,visemes:{}},playing:false});
  private preview:{id:string;actionId:string;at:number;targetId?:string}|null=null;
  private screenMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.90,1.63125),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));private screenTick:((time:number)=>void)|null=null;
  private manualFocus:string|null=null;private directed=true;private shot:Shot='auto';private lastTurn='';private shotCount=0;private currentShot:Shot='wide';private reactionFocus:string|null=null;private cameraProgress=0;private cameraSpeaker:string|null=null;private exportCamera=new THREE.PerspectiveCamera();private introCamera=new THREE.PerspectiveCamera();private captureTarget:THREE.WebGLRenderTarget|null=null;private captureLinear:THREE.WebGLRenderTarget|null=null;private captureOutput=new OutputPass();private pixels=new Uint8Array();private captureImage:ImageData|null=null;private afterFrame:(()=>void)|null=null;private audienceMode=false;
  coverage(shot:Shot,targetId:string|null=null){this.manualFocus=targetId;this.shot=shot;this.directed=true;this.lastTurn='';this.shotCount=0;this.currentShot='wide';}
  private timedCamera(frame:ReturnType<typeof this.sample>){const production=this.episode?.production;if(!production)return null;return timedCoverage(frame.programmeTimeMs??frame.timeMs,performanceTimeline(production,frame.cueLines),(production.cameraCues||[]).filter(cue=>cue.runId===production.runId),activeTurns(production));}
  onFrame(callback:()=>void){this.afterFrame=callback;}
  audience(value:boolean){this.audienceMode=value;}
  private actorPositions(){return new Map([...this.avatars].map(([id,item])=>[id,item.avatar.cameraAnchor()]));}
  // Gives travelling actions their partner's seat offset and adds the partner's
  // mirrored part: both meet halfway, swap seats or join a group dance.
  private stageActions(sampled:Map<string,ActiveAction[]>){
    const seatX=(id:string)=>this.avatars.get(id)?.avatar.group.position.x??0,occupied=new Set([...this.avatars.values()].map(item=>item.avatar.stageSeat));
    for(const [id,actions] of [...sampled]){for(const action of actions){
      if(action.stage)continue;const other=action.targetId&&action.targetId!==id&&this.avatars.has(action.targetId)?action.targetId:undefined;
      const nearest=()=>[...this.avatars.keys()].filter(key=>key!==id).sort((a,b)=>Math.abs(seatX(a)-seatX(id))-Math.abs(seatX(b)-seatX(id)))[0];
      if(PARTNER_ACTIONS.includes(action.actionId)||action.actionId==='movement.approach-person'){
        const partner=other||nearest();if(!partner)continue;const dx=seatX(partner)-seatX(id);action.stage={dx,role:'lead'};action.targetId=partner;
        const echo=action.actionId==='movement.approach-person'?{...action,actionId:'listening.track-speaker',targetId:id,stage:undefined}:{...action,targetId:id,stage:{dx:-dx,role:'partner' as const}};
        sampled.set(partner,[...(sampled.get(partner)||[]).filter(item=>item.actionId!==action.actionId),echo]);
      }else if(action.actionId==='movement.change-seat'){
        const seat=this.avatars.get(id)!.avatar.stageSeat,free=[0,1,2,3].filter(n=>!occupied.has(n)).sort((a,b)=>Math.abs(a-seat)-Math.abs(b-seat))[0];
        if(free!==undefined){action.stage={dx:(free-seat)*SEAT_SPACING,role:'lead'};continue;}
        const partner=other||nearest();if(!partner)continue;const dx=seatX(partner)-seatX(id);action.stage={dx,role:'lead',swap:true};
        sampled.set(partner,[...(sampled.get(partner)||[]).filter(item=>item.actionId!==action.actionId),{...action,targetId:id,stage:{dx:-dx,role:'partner',swap:true}}]);
      }else if(action.actionId==='celebration.group-dance'&&!action.stage){
        action.stage={dx:0,role:'lead'};for(const key of this.avatars.keys())if(key!==id&&!(sampled.get(key)||[]).some(item=>item.actionId===action.actionId))sampled.set(key,[...(sampled.get(key)||[]),{...action,intensity:action.intensity*.85,stage:{dx:0,role:'partner'}}]);
      }
    }}
  }
  private opening(frame:ReturnType<typeof this.sample>){
    if(!frame.playing||this.editing||this.timedCamera(frame)||this.shot!=='auto'||matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
    const manual=(frame as typeof frame&{shot?:Shot}).shot;if(manual&&manual!=='auto')return null;
    const first=this.episode?.production?activeTurns(this.episode.production)[0]:null;
    const host=this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId;
    if(!first||first.characterId!==host||frame.timeMs<first.startMs||frame.timeMs>=first.startMs+(first.durationMs||OPENING_DURATION_MS))return null;
    const position=this.actorPositions().get(host!);return position?{host:host!,position,timeMs:frame.timeMs-first.startMs,duration:Math.min(OPENING_DURATION_MS,first.durationMs||OPENING_DURATION_MS)}:null;
  }
  async readyForExport(){await this.branding.readyForExport();await Promise.all([...this.avatars.values()].map(item=>item.avatar.readyForMotions()));for(let i=0;i<600;i++){const items=[...this.avatars.values()];if(items.some(item=>item.avatar.state==='error'))throw new Error('A character model could not load. Retry the model before exporting.');if(items.length&&items.every(item=>item.avatar.state==='ready'))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('The cast is still loading. Your take is kept; retry export once the characters appear.');}
  private exporting=false;
  setExporting(value:boolean){this.exporting=value;}
  renderExport(timeMs:number){this.last=-Infinity;this.exportFrame=true;try{this.animate(timeMs);}finally{this.exportFrame=false;}}
  capture(canvas:HTMLCanvasElement){
    const width=canvas.width,height=canvas.height;if(this.captureTarget?.width!==width||this.captureTarget?.height!==height){this.captureTarget?.dispose();this.captureLinear?.dispose();this.captureTarget=new THREE.WebGLRenderTarget(width,height);this.captureLinear=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType});this.pixels=new Uint8Array(width*height*4);this.captureImage=new ImageData(width,height);}
    const frame=this.sample(),host=this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId;const automatic=(frame as typeof frame&{shot?:Shot}).shot==='auto';const shot=width<height&&automatic&&['wide','two-person'].includes(this.currentShot)?'speaker':this.currentShot;cameraPose(this.exportCamera,shot,this.actorPositions(),width<height&&automatic&&['wide','two-person'].includes(this.currentShot)?frame.speakerId||this.cameraSpeaker:this.cameraSpeaker||frame.speakerId,host,width/height,this.reactionFocus,this.cameraProgress);const intro=this.opening(frame);if(intro)openingCameraPose(this.exportCamera,intro.timeMs,intro.position,width/height,intro.duration);const exit=frame as typeof frame&{outro?:boolean;outroProgress?:number};if(exit.outro){const at=this.actorPositions().get(host||'');if(at)closingCameraPose(this.exportCamera,exit.outroProgress||0,at,width/height);}
    const menu=this.menu.mesh.visible,keys=this.keys.mesh.visible;this.menu.mesh.visible=false;this.keys.mesh.visible=false;this.avatars.forEach(item=>item.avatar.audience(true));const before=this.renderer.getRenderTarget();
    // Offscreen rendering is linear and skips tone mapping. Convert before byte readback.
    try{this.renderer.setRenderTarget(this.captureLinear);this.renderer.render(this.scene,this.exportCamera);this.captureOutput.render(this.renderer,this.captureTarget!,this.captureLinear!,0,false);this.renderer.readRenderTargetPixels(this.captureTarget!,0,0,width,height,this.pixels);const data=this.captureImage!.data;for(let y=0;y<height;y++)data.set(this.pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);canvas.getContext('2d')!.putImageData(this.captureImage!,0,0);}finally{this.renderer.setRenderTarget(before);this.menu.mesh.visible=menu;this.keys.mesh.visible=keys;this.avatars.forEach(item=>item.avatar.audience(this.audienceMode));}
  }
  screen(texture:THREE.Texture,tick:(time:number)=>void){this.screenMesh.material.map=texture;this.screenMesh.material.needsUpdate=true;this.screenTick=tick;}
  showBranding(premise:string,enabled=true){this.brandingEnabled=enabled;this.branding.group.visible=enabled&&!this.editing;this.branding.setTopic(premise);}
  performance(episode:EpisodeRecord|null,sample:typeof this.sample){this.episode=episode;this.sample=sample;}
  actions(id:string){const avatar=this.avatars.get(id)?.avatar;return performanceCatalogue(id,avatar?.capabilities()||{verified:false,bones:[],morphs:[]});}
  previewAction(id:string,actionId:string,targetId?:string){if(this.actions(id).find(action=>action.actionId===actionId)?.status!=='ready')throw new Error('This motion is not ready for this model.');this.preview={id,actionId,at:performance.now(),targetId};}
  clearPreview(){this.preview=null;}
  constructor(private canvas:HTMLCanvasElement,private action:(action:string)=>void,private xrChanged:(active:boolean)=>void){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.xr.enabled=true;this.renderer.xr.setReferenceSpaceType('local-floor');this.renderer.xr.setFramebufferScaleFactor(.8);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene.background=new THREE.Color('#111b26');this.scene.fog=new THREE.Fog('#111b26',18,32);this.scene.add(new THREE.HemisphereLight(0xe9f0ff,0x29232a,.9));
    const light=new THREE.DirectionalLight(0xffe3bf,3.4);light.position.set(-3,5,4);this.scene.add(light);const rim=new THREE.PointLight(0xec8058,24,10);rim.position.set(3,3,-3);this.scene.add(rim);
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();this.scene.environment=this.environment;
    this.camera.position.set(0,1.4,3.6);this.origin.add(this.camera);this.scene.add(this.origin,this.menu.mesh,this.keys.mesh,this.desk,this.branding.group);
    const box=(size:[number,number,number],at:[number,number,number],colour:string,parent:THREE.Object3D=this.scene)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color:colour,roughness:.65}));mesh.position.set(...at);parent.add(mesh);return mesh;};
    this.scene.add(this.studioSet.group);document.body.dataset.studioSet=JSON.stringify(this.studioSet.group.userData);
    box([4.25,.035,.12],[0,.75,-1.26],'#d89265');
    box([4.3,.12,1.1],[0,.79,-1.9],'#9d6b4f',this.desk);box([4.1,.62,.12],[0,.43,-1.32],'#23394a',this.desk);
    box([.12,.75,.9],[-1.95,.35,-1.9],'#1c2730',this.desk);box([.12,.75,.9],[1.95,.35,-1.9],'#1c2730',this.desk);
    this.desk.add(this.seating);
    this.screenMesh.position.set(0,3.03,-4.3);this.scene.add(this.screenMesh);
    const hands=new XRHandModelFactory();for(let index=0;index<2;index++){
      const controller=this.renderer.xr.getController(index);this.origin.add(controller);this.controllers.push(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-5)]),new THREE.LineBasicMaterial({color:0xe7b393}));controller.add(line);
      const hand=this.renderer.xr.getHand(index);hand.add(hands.createHandModel(hand,'spheres'));this.origin.add(hand);controller.addEventListener('select',()=>{if(!this.renderer.xr.isPresenting)return;controller.updateWorldMatrix(true,false);this.ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);this.ray.ray.direction.set(0,0,-1).transformDirection(controller.matrixWorld);this.select();});
    }
    this.renderer.xr.addEventListener('sessionstart',()=>{this.origin.position.z=3.6;this.menu.mesh.visible=true;this.xrChanged(true);});
    this.renderer.xr.addEventListener('sessionend',()=>{this.origin.position.set(0,0,0);this.camera.position.set(0,1.4,3.6);this.yaw=0;this.pitch=0;this.camera.rotation.set(0,0,0);this.menu.mesh.visible=false;this.keys.mesh.visible=false;this.xrChanged(false);this.resize();});
    canvas.addEventListener('pointerdown',event=>{this.drag={x:event.clientX,y:event.clientY,yaw:this.yaw,pitch:this.pitch,moved:false};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{if(!this.drag||this.renderer.xr.isPresenting)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;if(Math.hypot(dx,dy)>7)this.drag.moved=true;if(!this.drag.moved)return;this.directed=false;this.yaw=this.drag.yaw-dx*.002;this.pitch=THREE.MathUtils.clamp(this.drag.pitch-dy*.002,-.5,.5);this.look();});
    canvas.addEventListener('pointerup',event=>{const moved=this.drag?.moved;this.drag=null;if(moved||this.renderer.xr.isPresenting)return;const rect=canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);this.select();});
    canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)||this.renderer.xr.isPresenting)return;event.preventDefault();if(event.key==='Home'){this.yaw=0;this.pitch=0;}else{this.yaw+=event.key==='ArrowLeft'?.08:event.key==='ArrowRight'?-.08:0;this.pitch=THREE.MathUtils.clamp(this.pitch+(event.key==='ArrowUp'?.05:event.key==='ArrowDown'?-.05:0),-.5,.5);}this.look();});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();this.renderer.setAnimationLoop(this.animate);
  }
  private look(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}
  private resize(){if(this.renderer.xr.isPresenting)return;const {clientWidth:width,clientHeight:height}=this.canvas;if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  private select(){
    const surfaces=[this.menu,this.keys].filter(surface=>surface.mesh.visible);const hits=this.ray.intersectObjects([...surfaces.map(surface=>surface.mesh),this.screenMesh,...[...this.avatars.values()].map(item=>item.avatar.hitbox)],false);
    for(const hit of hits){if(hit.object===this.screenMesh&&this.screenMesh.visible){this.action('screen');return;}const surface=surfaces.find(surface=>surface.mesh===hit.object);if(surface){const action=hit.uv&&surface.hit(hit.uv);if(action){this.action(action);return;}}else{const actor=[...this.avatars.values()].find(item=>item.avatar.hitbox===hit.object);if(actor){this.action('inspect:'+actor.avatar.character.id);return;}}}
  }
  private publishSurfaces(){document.body.dataset.studioSurfaces=JSON.stringify([this.menu,this.keys].filter(surface=>surface.mesh.visible).map(surface=>({position:surface.mesh.position.toArray(),size:[surface.mesh.geometry.parameters.width,surface.mesh.geometry.parameters.height],canvas:[surface.canvas.width,surface.canvas.height],buttons:surface.buttons})));}
  private arrangeSeats(count:number){
    if(count===this.seatCount)return;this.seatCount=count;
    this.seating.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});this.seating.clear();
    const box=(size:[number,number,number],at:[number,number,number],colour:string,parent:THREE.Object3D=this.seating)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color:colour,roughness:.7}));mesh.position.set(...at);parent.add(mesh);};
    for(let index=0;index<count;index++){
      const x=(index-(count-1)/2)*(count===4?1.05:1.35),chair=new THREE.Group();chair.name='chair-'+index;this.seating.add(chair);
      box([.5,.1,.5],[x,.46,-2.8],'#384450',chair);box([.48,.7,.08],[x,.85,-3.06],'#384450',chair);
      for(const side of [-1,1])box([.035,.42,.4],[x+side*.21,.22,-2.8],'#202b35',chair);

    }
    document.body.dataset.studioSeatCount=String(count);
  }
  setCast(characters:Character[],preview:Character|null=null,seats?:{characterId:string;seatIndex:number}[]){
    const wanted=preview?[preview]:characters.slice(0,4);this.editing=!!preview;this.branding.group.visible=this.brandingEnabled&&!preview;this.arrangeSeats(preview?0:4);document.body.dataset.studioSeatCount=String(preview?0:wanted.length);document.body.dataset.studioSeatCapacity=String(preview?0:4);this.desk.visible=!preview;this.screenMesh.visible=!preview;
    for(const [id,item] of this.avatars)if(!wanted.some(actor=>actor.id===id)){this.scene.remove(item.avatar.group);item.avatar.dispose();this.avatars.delete(id);}
    wanted.forEach((actor,index)=>{
      const seat=preview?0:seats?.find(member=>member.characterId===actor.id)?.seatIndex??index;
      const signature=JSON.stringify([actor.name,actor.avatar]);let item=this.avatars.get(actor.id);
      if(item?.signature!==signature){if(item){this.scene.remove(item.avatar.group);item.avatar.dispose();}const avatar=new RealisticAvatar(actor,realisticModelFor(actor),this.environment,()=>queueMicrotask(()=>{if(this.disposed)return;document.body.dataset.studioAvatarErrors=String([...this.avatars.values()].filter(item=>item.avatar.state==='error').length);document.body.dataset.studioMotionErrors=String([...this.avatars.values()].filter(item=>item.avatar.motionFailed).length);this.action('assets-changed');}));item={avatar,signature};this.avatars.set(actor.id,item);this.scene.add(avatar.group);}
      item.avatar.group.position.set(preview?0:(seat-1.5)*1.05,0,preview?-1.55:-2.8);item.avatar.setSeatStyle(seat);item.avatar.setSeated(!preview);item.avatar.setPresence(preview?'Preview':'Ready',!!preview);item.avatar.setRoom('conference');
    });
  }
  panel(title:string,body:string,buttons:StudioButton[]){this.menu.draw('Studio controls',title,body.slice(0,210),[...buttons.slice(0,6).map((button,index)=>({x:25+(index%3)*320,y:420+Math.floor(index/3)*74,width:300,height:62,...button})),...([{label:'Room',action:'home'},{label:'Pause / stop voice',action:'pause'},{label:'Exit VR',action:'exit-vr'}].map((button,index)=>({x:25+index*320,y:580,width:300,height:32,...button})))]);this.publishSurfaces();}
  keyboard(text:string,visible:boolean,hindi=false){
    this.keys.mesh.visible=visible&&this.renderer.xr.isPresenting;this.menu.mesh.visible=!visible&&this.renderer.xr.isPresenting;
    if(!visible){this.publishSurfaces();return;}
    const alphabet=Array.from(hindi?'अआइईउऊएकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसहािीुूेैोौंँ्।':'1234567890qwertyuiopasdfghjklzxcvbnm.,?!');
    const buttons=alphabet.map((key,index)=>({x:10+(index%12)*82,y:240+Math.floor(index/12)*50,width:75,height:44,label:key,action:'key:'+key}));
    [{label:'Space',action:'key:space'},{label:'⌫',action:'key:backspace'},{label:hindi?'ABC':'हिन्दी',action:'key:language'},{label:'Use words',action:'key:accept'},{label:'Cancel',action:'key:close'}].forEach((button,index)=>buttons.push({x:10+index*196,y:515,width:186,height:58,...button}));
    buttons.push({x:10,y:175,width:475,height:45,label:'Pause / stop voice',action:'pause'},{x:510,y:175,width:475,height:45,label:'Exit VR',action:'exit-vr'});
    this.keys.draw('Write or speak',text.slice(-36)||'Your words','',buttons);this.publishSurfaces();
  }
  async enter(){if(!navigator.xr)throw new Error('Open in a headset browser to enter VR.');const session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['hand-tracking']});try{await this.renderer.xr.setSession(session);}catch(error){await session.end();throw error;}}
  async exit(){await this.renderer.xr.getSession()?.end();}
  retry(){this.avatars.forEach(item=>item.avatar.retry());}
  portrait(){
    if(this.renderer.xr.isPresenting)return null;const item=[...this.avatars.values()][0];if(!this.editing||item?.avatar.state!=='ready')return null;
    const head=item.avatar.poseSnapshot().joints.Head;if(!head)return null;const at=new THREE.Vector3().fromArray(head),position=this.camera.position.clone(),rotation=this.camera.quaternion.clone(),aspect=this.camera.aspect,size=this.renderer.getSize(new THREE.Vector2());
    try{this.camera.position.copy(at).add(new THREE.Vector3(0,.01,1));this.camera.lookAt(at);this.camera.aspect=1;this.camera.updateProjectionMatrix();this.renderer.setSize(192,192,false);this.renderer.render(this.scene,this.camera);return this.canvas.toDataURL('image/webp',.8);}finally{this.camera.position.copy(position);this.camera.quaternion.copy(rotation);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();this.renderer.setSize(size.x,size.y,false);}
  }
  private animate=(time:number)=>{
    if(this.disposed||this.exporting&&!this.exportFrame||!this.renderer.xr.isPresenting&&time-this.last<33)return;this.last=time;this.screenTick?.(time);this.camera.getWorldPosition(this.viewer);const frame=this.sample(),production=this.episode?.production;
    this.branding.tick(frame.turnId?(frame as typeof frame&{programmeTimeMs?:number}).programmeTimeMs??frame.timeMs:time,matchMedia('(prefers-reduced-motion: reduce)').matches,this.exportFrame);
    const intro=this.opening(frame),openingState=intro?openingCameraPose(this.introCamera,intro.timeMs,intro.position,this.camera.aspect,intro.duration):null;
    if(intro&&this.directed&&!this.renderer.xr.isPresenting)openingCameraPose(this.camera,intro.timeMs,intro.position,this.camera.aspect,intro.duration);
    this.camera.getWorldPosition(this.viewer);
    document.body.dataset.studioOpening=openingState?.phase||'none';
    const introductionId=production&&activeTurns(production).find(turn=>turn.id===frame.turnId)?.introductionId;
    const performanceCues=performanceTimelineCues(production,frame.cueLines),animationMs=frame.turnId?(frame as typeof frame&{programmeTimeMs?:number}).programmeTimeMs??frame.timeMs:time;
    document.body.dataset.studioClocks=JSON.stringify({sourceMs:frame.timeMs,animationMs,playing:frame.playing,speakerId:frame.speakerId,turnId:frame.turnId});
    const sampled=new Map<string,ActiveAction[]>();
    this.avatars.forEach((item,id)=>{let actions=frame.playing?performanceSample(performanceCues,animationMs,{characterId:id,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}):[];
      if(this.preview?.id===id){const elapsed=time-this.preview.at;const duration=motionDuration(this.preview.actionId);if(elapsed<duration)actions=performanceSample([{id:'preview',characterId:id,actionId:this.preview.actionId,atMs:0,durationMs:duration,intensity:.8,targetId:this.preview.targetId}],elapsed,{characterId:id,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});else this.preview=null;}
      sampled.set(id,actions);});
    this.stageActions(sampled);
    this.avatars.forEach((item,id)=>{item.avatar.group.rotation.y=intro?.host===id?openingState!.hostYaw:0;const actor=item.avatar.character as Character&{studioProfile?:{behaviour:{energy:number}}};const actions=sampled.get(id)||[];
      const broadcast=this.renderer.xr.isPresenting?this.viewer.clone():new THREE.Vector3(0,1.5,2.8),neutral=item.avatar.cameraAnchor().add(new THREE.Vector3(.08*(item.avatar.character.id.charCodeAt(0)%3-1),-.07,2.6));
      const gaze=attentionSample({characterId:id,turns:production?activeTurns(production):[],timeMs:frame.timeMs,hostId:this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId,script:production?.writer?.lines,atTurn:production?.writer?.atTurn,energy:actor.studioProfile?.behaviour.energy});
      let attention=production?new THREE.Vector3():this.viewer.clone();if(production)for(const [targetId,weight] of Object.entries(gaze.weights)){const point=targetId==='broadcast'?broadcast:targetId==='neutral'?neutral:this.avatars.get(targetId)?.avatar.cameraAnchor()||neutral;attention.addScaledVector(point,weight);}
      const directed=actions.find(action=>(action.targetId||action.actionId==='listening.track-speaker')&&action.intensity>.05),directedActor=this.avatars.get(directed?.targetId||frame.speakerId||'')?.avatar;if(directed){const point=directedActor?.cameraAnchor()||(directed.targetId==='main-screen'?this.screenMesh.position.clone():item.avatar.cameraAnchor().add(new THREE.Vector3(0,-.4,.5)));attention.lerp(point,Math.min(1,directed.intensity));}
      const hostLook=actions.find(a=>a.actionId==='response.look-to-host'),cameraLook=actions.find(a=>a.actionId==='drama.slow-turn-to-camera'||a.actionId==='comedy.wink-at-camera'),between=actions.find(a=>a.actionId==='listening.look-between-speakers');
      if(hostLook){const host=this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId,person=host&&this.avatars.get(host);if(person)attention.lerp(person.avatar.cameraAnchor(),hostLook.envelope||hostLook.intensity);}
      if(cameraLook)attention.lerp(this.viewer,Math.min(1,cameraLook.progress*2)*(cameraLook.envelope||cameraLook.intensity));
      if(between){const people=[...this.avatars.values()].filter(other=>other!==item),a=people[0]?.avatar.cameraAnchor(),b=people[1]?.avatar.cameraAnchor();if(a&&b)attention.lerp(a.lerp(b,THREE.MathUtils.smoothstep(between.progress,.25,.70)),between.envelope||between.intensity);}
      if(introductionId===id)attention.lerp(this.viewer,.8);
      if(intro?.host===id)attention=openingState!.attention;
      item.avatar.group.userData.attention={...gaze,point:attention.toArray()};
      item.avatar.setPresence(frame.speakerId===id?'Speaking':frame.playing?'Listening':this.editing?'Preview':'Ready',frame.speakerId===id);item.avatar.setStudioActions(actions,actor.studioProfile?.behaviour.energy??.5);item.avatar.studioTime(!!frame.turnId);item.avatar.animate(animationMs,attention,frame.speakerId===id?frame.mouth:{open:0,round:0,wide:0,hiss:0,visemes:{}});const chair=this.seating.getObjectByName('chair-'+item.avatar.stageSeat);if(chair)chair.position.z=-.38*item.avatar.stageStand;
    });
    const timed=this.timedCamera(frame),lineShot=(frame as typeof frame&{shot?:Shot}).shot,requested=timed?timed.shot as Shot:lineShot&&lineShot!=='auto'?lineShot:this.shot;if(requested==='auto'&&production){const coverage=automaticCoverage(frame.programmeTimeMs??frame.timeMs,performanceTimeline(production,frame.cueLines),performanceCues,{hostId:this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId,staging:production.writer?.staging?{atTurn:production.writer.atTurn,lines:production.writer.staging.lines}:undefined,script:production.writer?.lines});this.currentShot=coverage.shot;this.reactionFocus=coverage.focusId;this.cameraSpeaker=coverage.viewSpeakerId;this.cameraProgress=matchMedia('(prefers-reduced-motion: reduce)').matches?0:coverage.progress;}else{this.currentShot=requested==='auto'?'wide':requested;this.reactionFocus=timed?.characterId||this.manualFocus;this.cameraSpeaker=timed?.characterId||this.manualFocus||frame.speakerId;this.cameraProgress=0;}
    if(introductionId&&frame.playing&&!intro&&this.shot==='auto'&&!timed&&(!lineShot||lineShot==='auto')){this.currentShot='close-up';this.reactionFocus=introductionId;this.cameraSpeaker=introductionId;this.cameraProgress=0;}
    document.body.dataset.studioIntroduction=frame.playing?introductionId||'':'';
    if(!intro&&!this.renderer.xr.isPresenting&&this.directed&&frame.playing){cameraPose(this.camera,this.currentShot,this.actorPositions(),this.cameraSpeaker||frame.speakerId,this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId,this.camera.aspect,this.reactionFocus,this.cameraProgress);}
    const exit=frame as typeof frame&{outro?:boolean;outroProgress?:number};document.body.dataset.studioClosing=exit.outro?'fly-out':'none';if(exit.outro&&this.directed&&!this.renderer.xr.isPresenting){const host=this.episode?.plan.cast.find(member=>member.slotId==='host')?.characterId,at=this.actorPositions().get(host||'');if(at)closingCameraPose(this.camera,exit.outroProgress||0,at,this.camera.aspect);}
    this.avatars.forEach(item=>item.avatar.audience(this.audienceMode));if(!this.exportFrame)this.renderer.render(this.scene,this.camera);this.afterFrame?.();document.body.dataset.studioShot=this.renderer.xr.isPresenting?'headset':this.currentShot;document.body.dataset.studioCamera=JSON.stringify({position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),speaker:this.cameraSpeaker});
    document.body.dataset.studioFrame=String(++this.frames);
    if(this.frames%20===0){document.body.dataset.studioActors=JSON.stringify([...this.avatars.values()].map(item=>({id:item.avatar.character.id,state:item.avatar.state,model:item.avatar.model,renderer:'rocketbox',attention:item.avatar.group.userData.attention,readyActions:this.actions(item.avatar.character.id).filter(action=>action.status==='ready').map(action=>action.actionId),...item.avatar.poseSnapshot()})));document.body.dataset.realisticAvatars=String([...this.avatars.values()].filter(item=>item.avatar.state==='ready').length);document.body.dataset.studioSurfaces=JSON.stringify([this.menu,this.keys].filter(surface=>surface.mesh.visible).map(surface=>({position:surface.mesh.position.toArray(),size:[surface.mesh.geometry.parameters.width,surface.mesh.geometry.parameters.height],canvas:[surface.canvas.width,surface.canvas.height],buttons:surface.buttons})));}
  };
  dispose(){this.disposed=true;this.observer.disconnect();this.renderer.setAnimationLoop(null);this.avatars.forEach(item=>item.avatar.dispose());this.arrangeSeats(0);this.menu.dispose();this.keys.dispose();this.branding.dispose();this.studioSet.dispose();this.screenMesh.geometry.dispose();this.screenMesh.material.dispose();this.captureTarget?.dispose();this.captureLinear?.dispose();this.captureOutput.dispose();this.environment.dispose();this.renderer.dispose();}
}
