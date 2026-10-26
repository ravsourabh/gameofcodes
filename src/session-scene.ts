import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import type { SessionMode, Character } from '../shared/session-domain.mjs';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RealisticAvatar, realisticModelFor, type Mouth, type SceneAvatar } from './realistic-avatar';
import {EnvironmentAssets} from './environment-assets';
import {buildThroneCourt} from './throne-court';
import {CourtSurface,type CourtState,type SurfaceButton} from './court-surfaces';
import {Roundtable,conferenceSeat} from './roundtable';
import {BroadcastCamera} from './broadcast-camera';

export type SceneAction = 'discussion' | 'rehearsal' | 'save' | 'home' | 'exit' | 'characters' | 'character:new' | 'character:reroll' | 'character:save' | 'character:next' | 'character:cast' | 'character:close' | `workshop:${string}` | `ai:${string}` | `key:${string}` | `guide:${string}` | `discuss:${string}` | `court:${string}`;
type Action = SceneAction;
export type CharacterPanel = { id?:string;name: string; code: string; inCast: boolean; guide: boolean; discardPending?: boolean; feature?:string;buttons?:Button[] };
type PanelState = { mode: SessionMode; title: string; status: string; busy: boolean; character?: CharacterPanel; caption?:string; keyboard?:string;guidance?:{caption:string;choices:{label:string;action:string}[]};discussion?:{caption:string;choices:{label:string;action:string}[]};court?:CourtState };
type Button = { x: number; y: number; width: number; height: number; label: string; action: Action };
const buttons: Button[] = [
  { x: 40, y: 255, width: 440, height: 76, label: 'Throne court', action: 'discussion' },
  { x: 520, y: 255, width: 440, height: 76, label: 'Council chamber', action: 'rehearsal' },
  { x: 40, y: 365, width: 285, height: 74, label: 'Save session', action: 'save' },
  { x: 357, y: 365, width: 285, height: 74, label: 'Start screen', action: 'home' },
  { x: 675, y: 365, width: 285, height: 74, label: 'Leave VR', action: 'exit' },
  { x: 690, y: 195, width: 270, height: 44, label: 'Characters', action: 'characters' },
];

// A seated court: the room carries the experience and detail opens only on request.
export class SessionScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 45);
  private origin = new THREE.Group();
  private rooms: Record<SessionMode, THREE.Group> = { discussion: new THREE.Group(), rehearsal: new THREE.Group() };
  private raycaster = new THREE.Raycaster();
  private panelCanvas = document.createElement('canvas');
  private panelContext: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private panel: THREE.Mesh;
  private controllers: { controller: THREE.Group; cursor: THREE.Mesh }[] = [];
  private current: PanelState = { mode: 'discussion', title: 'Your next question', status: 'Choose a room and save a session.', busy: false };
  private resizeObserver: ResizeObserver;
  private active = false;
  private flashUntil = 0;
  private lastRender = 0;
  private disposed = false;
  private avatars = new Map<string, { avatar: SceneAvatar; signature: string; kind: 'guide' | 'cast' | 'preview'; index: number }>();
  private environment: THREE.Texture | null = null;
  private cast: Parameters<SessionScene['setCast']> | null = null;
  // The current speaker and their mouth shape, read every frame for lip-sync.
  speech?: () => { id: string; mouth: Mouth } | null;
  private speechLevel = 0;
  private viewer = new THREE.Vector3();
  onCharacterSelect?: (id: string) => void;
  onFeatureSelect?: (feature:string) => void;
  onHeadInspect?: (id:string) => void;
  private lastHead={id:'',at:0};
  private assets=new EnvironmentAssets();
  private conference=new Roundtable(this.assets);private director:BroadcastCamera;
  private surfaces={caption:new CourtSurface('caption',2.3,.52,[0,1.05,-.2]),actions:new CourtSurface('actions',2.3,.38,[0,.64,-.1]),view:new CourtSurface('view',1.02,1.03,[-1.85,1.42,-.48],.48),scores:new CourtSurface('scores',.95,.78,[1.85,1.44,-.48],-.48)};
  private menuOpen=false;private viewPage=0;private scoresOpen=false;private lastFocus='';
  private drag:{x:number;y:number;yaw:number;pitch:number;moved:boolean}|null=null;private yaw=0;private pitch=0;
  private frameSamples:number[]=[];private frameIntervals:number[]=[];private frameCount=0;

  constructor(private canvas: HTMLCanvasElement, private action: (action: Action) => void, private sessionChanged: (active: boolean) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFramebufferScaleFactor(.8);
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.scene.background = new THREE.Color('#1a2028');
    this.scene.fog = new THREE.Fog('#1a2028', 15, 34);
    this.scene.add(new THREE.HemisphereLight(0xe0e7f2, 0x373025, 1.65));
    const sun = new THREE.DirectionalLight(0xffe3bd, 3.1); sun.position.set(-4, 7, 4); this.scene.add(sun);
    this.camera.position.set(0, 1.3, 2.5); this.camera.lookAt(0, 1.3, -3);
    this.director=new BroadcastCamera(this.camera);this.scene.add(this.conference.group);this.conference.group.visible=false;
    this.origin.add(this.camera); this.scene.add(this.origin);
    for (const [mode, room] of Object.entries(this.rooms) as [SessionMode, THREE.Group][]) { this.buildRoom(room, mode); this.scene.add(room); }
    this.panelCanvas.width = 1000; this.panelCanvas.height = 500;
    this.panelContext = this.panelCanvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.panelCanvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.25), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    this.panel.position.set(0, 1.25, -0.2); this.panel.visible = false; this.scene.add(this.panel);
    for(const surface of Object.values(this.surfaces))this.scene.add(surface.mesh);
    const handFactory = new XRHandModelFactory();
    for (let index = 0; index < 2; index++) {
      const controller = this.renderer.xr.getController(index); this.origin.add(controller);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xddc89b, transparent: true, opacity: 0.65 }));
      line.scale.z = 5; controller.add(line);
      const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf6deb1 })); cursor.visible = false; this.scene.add(cursor);
      const hand = this.renderer.xr.getHand(index); hand.add(handFactory.createHandModel(hand, 'spheres')); this.origin.add(hand);
      controller.addEventListener('select', () => {
        if (!this.active) return;
        const hit = this.intersection(controller);
        if (hit) this.selectHit(hit);
      });
      this.controllers.push({ controller, cursor });
    }
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.director.reset();this.active = true; this.origin.position.z = 2.5; this.menuOpen=false; this.sessionChanged(true);this.updateSurfaces();
      this.positionCharacters();
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.active = false; this.origin.position.set(0, 0, 0); this.camera.position.set(0, 1.3, 2.5);this.yaw=0;this.pitch=0;this.look();
      this.panel.visible = false;Object.values(this.surfaces).forEach(s=>s.mesh.visible=false); this.controllers.forEach(item => item.cursor.visible = false); this.sessionChanged(false);
      this.positionCharacters();
    });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerup', this.pointerSelect);
    canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointercancel',this.pointerCancel);canvas.addEventListener('keydown',this.lookKey);
    {
      // A soft studio reflection for skin and cloth; the greybox room keeps its own lighting.
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
    }
    document.body.dataset.avatarStyle = 'realistic';
    this.update(this.current); this.resize(); this.renderer.setAnimationLoop(this.animate);
  }

  setCast(guide: Character, cast: Character[], preview: Character | null = null) {
    this.cast = [guide, cast, preview];
    const wanted: { character: Character; kind: 'guide' | 'cast' | 'preview'; index: number }[] = [{ character: preview?.id === guide.id ? preview : guide, kind: 'guide', index: 0 }];
    if (preview && preview.id !== guide.id) wanted.push({ character: preview, kind: 'preview', index: 0 });
    else cast.filter(character => character.id !== guide.id).slice(0, 5).forEach((character, index) => wanted.push({ character, kind: 'cast', index }));
    const ids = new Set(wanted.map(item => item.character.id));
    for (const [id, item] of this.avatars) if (!ids.has(id)) { this.scene.remove(item.avatar.group); item.avatar.dispose(); this.avatars.delete(id); }
    for (const item of wanted) {
      const signature = JSON.stringify([item.character.name, item.character.avatar]);
      let existing = this.avatars.get(item.character.id);
      if (existing?.signature !== signature) {
        if (existing) { this.scene.remove(existing.avatar.group); existing.avatar.dispose(); }
        const avatar = new RealisticAvatar(item.character, realisticModelFor(item.character), this.environment,()=>queueMicrotask(()=>this.avatarStatus()));
        existing = { avatar, signature, kind: item.kind, index: item.index };
        this.avatars.set(item.character.id, existing); this.scene.add(existing.avatar.group);
      }
      existing.kind = item.kind; existing.index = item.index;
      existing.avatar.setFeature(preview?.id===item.character.id?this.current.character?.feature:undefined);
    }
    this.positionCharacters();
    document.body.dataset.visibleCharacters = String(this.avatars.size);
    document.body.dataset.guideId = guide.id;
    this.avatarStatus();
  }

  private avatarStatus(){
    if(this.disposed)return;
    const avatars=[...this.avatars.entries()].map(([id,{avatar}])=>({id,model:(avatar as RealisticAvatar).model,state:(avatar as RealisticAvatar).state,position:avatar.group.position.toArray()}));
    document.body.dataset.avatarModels=JSON.stringify(avatars);const failed=avatars.filter(a=>a.state==='error').length,loading=avatars.filter(a=>a.state==='loading').length;
    document.body.dataset.realisticAvatars=String(avatars.filter(a=>a.state==='ready').length);
    document.body.dataset.avatarErrors=String(failed);document.body.dataset.avatarsLoading=String(loading);
    const retry=document.querySelector<HTMLButtonElement>('#avatar-retry');if(retry){retry.hidden=!failed;retry.textContent=`Retry avatar${failed>1?'s':''}`;}
    const status=document.querySelector<HTMLElement>('#avatar-status');if(status)status.textContent=failed?'An avatar could not load. Retry to show it.':loading?'Loading human avatars…':'';
  }
  retryAvatars(){for(const {avatar} of this.avatars.values())(avatar as RealisticAvatar).retry();}

  private positionCharacters() {
    const previewing = [...this.avatars.values()].some(item => item.kind === 'preview');
    const count=[...this.avatars.values()].filter(item=>item.kind==='cast').length;
    const seated=this.current.mode==='discussion'&&!previewing&&!this.current.character;this.conference.update(count,seated&&count>0,this.current.court?.showRoom,this.current.court?.title,this.current.court?.showStyle);
    for (const { avatar, kind, index } of this.avatars.values()) {
      (avatar as RealisticAvatar).setSeated(seated&&kind==='cast');
      // On desktop the guide stands back far enough to stay whole above the conversation dock.
      if (kind === 'guide') {
        const x=this.active?(this.current.discussion?-2.7:-1.75):previewing?-2.1:this.current.discussion?-2.8:-.95;
        const z=this.active?(this.current.discussion ? .1 : -.85):previewing?-.85:this.current.discussion?-1.15:-.45;
        avatar.group.position.set(x,0,z);
      }
      else if (kind === 'preview') avatar.group.position.set(this.active ? 1.8 : -.75, 0, this.active ? -.85 : .15);
      else {
        if(seated){const seat=conferenceSeat(index,count);avatar.group.position.copy(seat.position);}else{const x = (index-(count-1)/2)*Math.min(1.35,4.8/Math.max(1,count-1));avatar.group.position.set(x,0,this.current.mode==='rehearsal'?-3.65:-2.6);}
      }
      avatar.group.rotation.y=kind==='cast'?seated?conferenceSeat(index,count).yaw:Math.atan2(-avatar.group.position.x,2.5-avatar.group.position.z)*.65:0;
    }
  }

  selectCharacter(id: string) {
    this.avatars.get(id)?.avatar.select();
    document.body.dataset.selectedCharacter = id;
  }
  toggleCamera(){this.director.toggle();this.yaw=0;this.pitch=0;document.body.dataset.cameraMode=this.director.enabled?'broadcast':'manual';}

  private pointerDown=(event:PointerEvent)=>{if(this.active||event.button!==0)return;this.drag={x:event.clientX,y:event.clientY,yaw:this.yaw,pitch:this.pitch,moved:false};this.canvas.setPointerCapture(event.pointerId);};
  private pointerMove=(event:PointerEvent)=>{if(!this.drag||this.active||this.current.character)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;if(Math.hypot(dx,dy)>6)this.drag.moved=true;if(!this.drag.moved)return;this.director.manual();const yaw=this.drag.yaw-dx*.0025;this.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));this.pitch=THREE.MathUtils.clamp(this.drag.pitch-dy*.002,-.6,.7);this.look();};
  private pointerCancel=()=>{this.drag=null;};
  private lookKey=(event:KeyboardEvent)=>{if(this.active||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();this.director.manual();if(event.key==='Home'){this.yaw=0;this.pitch=0;}else{const yaw=this.yaw+(event.key==='ArrowLeft'?.08:event.key==='ArrowRight'?-.08:0);this.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));this.pitch=THREE.MathUtils.clamp(this.pitch+(event.key==='ArrowUp'?.06:event.key==='ArrowDown'?-.06:0),-.6,.7);}this.look();};
  private look(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');document.body.dataset.courtLook=JSON.stringify({yaw:this.yaw,pitch:this.pitch});}
  private surfaceAction(action:string){
    document.body.dataset.courtAction=action;
    if(action==='court:menu'){this.menuOpen=true;this.update(this.current);return;}
    if(action==='court:close'){this.menuOpen=false;this.update(this.current);return;}
    if(action==='court:view-next'){this.viewPage++;this.updateSurfaces();return;}
    if(action==='court:scores'){this.scoresOpen=!this.scoresOpen;this.updateSurfaces();return;}
    this.menuOpen=false;this.action(action as SceneAction);this.updateSurfaces();
  }
  private updateSurfaces(){
    const state=this.current,court=state.court,f=court?.focus,detail=state.keyboard!==undefined||!!state.character||this.menuOpen;
    this.panel.visible=this.active&&detail;
    const available=state.discussion?.choices||state.guidance?.choices||[{label:'Throne court',action:'discussion'},{label:'Council',action:'rehearsal'}];
    const prefix=state.discussion?'discuss:':state.guidance?'guide:':'';
    const choices=(state.discussion?available.slice(0,2):available.slice(0,4)).map((c,i)=>({x:12+i*248,y:12,width:236,height:64,label:c.label,action:prefix+c.action}));
    const extras=[{label:'Speak',action:'ai:mic'},{label:'Interrupt',action:state.discussion?'discuss:pause':'ai:stop'},{label:'Controls',action:'court:menu'},{label:'Leave VR',action:'exit'}].map((c,i)=>({x:12+i*248,y:88,width:236,height:64,...c}));
    if(document.body.dataset.avatarErrors!=='0'&&document.body.dataset.avatarErrors){const occupied=choices.findIndex(b=>b.x===508);if(occupied>=0)choices.splice(occupied,1);choices.push({x:508,y:12,width:236,height:64,label:'Retry avatar',action:'ai:avatar-retry'});}
    this.surfaces.actions.draw('','','',[...choices,...extras]);
    const caption=state.guidance&&!state.discussion&&court?.phase!=='Speaking'?state.guidance.caption:state.caption||state.status;
    this.surfaces.caption.draw(court?.phase||'Your guide',state.title,caption,[{x:890,y:180,width:45,height:36,label:'‹',action:'ai:previous'},{x:943,y:180,width:45,height:36,label:'›',action:'ai:next'}]);
    if(f){if(this.lastFocus!==f.id){this.lastFocus=f.id;this.viewPage=0;}const pages=[`Guiding code: ${f.code}`,`Current view: ${f.position}${f.previous?' Earlier: '+f.previous:''}`,`Latest reasoning: ${f.reason}`].flatMap(t=>t.match(/[\s\S]{1,210}(?:\s|$)|\S{1,210}/g)||['']);
      const index=this.viewPage%pages.length;this.surfaces.view.draw(f.role,f.name,pages[index],[{x:25,y:890,width:300,height:85,label:`Next ${index+1}/${pages.length}`,action:'court:view-next'},{x:345,y:890,width:300,height:85,label:'Give floor',action:'court:floor'},{x:665,y:890,width:310,height:85,label:'Brain',action:'court:brain'}]);}
    this.surfaces.scores.draw('Your judgement',court?.ratings.some(r=>r.count)?'Saved ratings':'No ratings yet',this.scoresOpen?`${court?.ratings.map(r=>r.name+': '+(r.count?r.count+' ratings':'unrated')).join('. ')}. ${court?.criteria.join(' · ')||'Your criteria will appear here.'}`:'Your points and criteria belong beside the conversation.',[{x:30,y:700,width:940,height:80,label:this.scoresOpen?'Close judgement':'View judgement',action:'court:scores'}]);
    this.surfaces.caption.mesh.visible=this.active&&!detail;this.surfaces.actions.mesh.visible=this.active&&!detail;this.surfaces.view.mesh.visible=this.active&&!detail&&!!state.discussion&&!!f;this.surfaces.scores.mesh.visible=this.active&&!detail&&!!state.discussion;
    const surfaces=Object.values(this.surfaces).filter(s=>s.mesh.visible).map(s=>({name:s.name,position:s.mesh.position.toArray(),size:[s.mesh.geometry.parameters.width,s.mesh.geometry.parameters.height],yaw:s.mesh.rotation.y,canvas:[s.canvas.width,s.canvas.height],buttons:s.buttons}));
    if(this.panel.visible)surfaces.push({name:'panel',position:this.panel.position.toArray(),size:[2.5,1.25],yaw:0,canvas:[1000,500],buttons:this.interactiveButtons()});
    document.body.dataset.nativeSurfaces=JSON.stringify(surfaces);document.body.dataset.courtMenu=String(this.menuOpen);document.body.dataset.courtStage=JSON.stringify({presenter:{x:0,z:-2.3},waiting:{x:3.65,z:-5.6},selectedId:court?.selectedId||'',speakerId:court?.speakerId||'',phase:court?.phase||'Ready'});
  }

  private pointerSelect = (event: PointerEvent) => {
    const moved=this.drag?.moved;this.drag=null;if(moved)return;
    if (this.active || this.current.busy) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObjects(this.characterTargets(), false)[0];
    if (hit) this.selectHit(hit);
  };

  private selectHit(hit: THREE.Intersection) {
    if(hit.object.userData.courtSurface&&hit.uv){const surface=Object.values(this.surfaces).find(s=>s.mesh===hit.object),action=surface?.hit(hit.uv);if(action)this.surfaceAction(action);}
    else if (hit.object === this.panel && hit.uv) this.selectPanel(hit.uv.x * 1000, (1 - hit.uv.y) * 500);
    else if (!this.current.busy && hit.object.userData.characterId) { const id = String(hit.object.userData.characterId); this.selectCharacter(id); if(hit.object.userData.feature&&this.current.character?.id===id)this.onFeatureSelect?.(hit.object.userData.feature);else if(hit.object.userData.feature==='face'&&this.lastHead.id===id&&performance.now()-this.lastHead.at<650){this.lastHead={id:'',at:0};this.onHeadInspect?.(id);}else{this.lastHead={id,at:performance.now()};this.onCharacterSelect?.(id);} }
  }

  private box(room: THREE.Group, size: [number, number, number], at: [number, number, number], colour: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 })); mesh.position.set(...at); room.add(mesh); return mesh;
  }
  private seat(room: THREE.Group, x: number, z: number, colour: number) {
    this.box(room, [0.62, 0.18, 0.64], [x, 0.5, z], colour);
    this.box(room, [0.62, 0.9, 0.12], [x, 0.95, z - 0.28], colour);
    for (const side of [-1, 1]) this.box(room, [0.08, 0.48, 0.5], [x + side * 0.22, 0.24, z], 0x4f5e58);
  }
  private buildRoom(room: THREE.Group, mode: SessionMode) {
    if(mode==='discussion'){buildThroneCourt(room,this.assets);return;}
    this.box(room, [15, 0.15, 18], [0, -0.1, -3], 0x354c47);
    this.box(room, [15, 7, 0.3], [0, 3.4, -10], 0x475f63);
    for (const side of [-1, 1]) {
      this.box(room, [0.35, 7, 18], [side * 7.5, 3.4, -3], 0x4b635c);
      for (const z of [-7, -3, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 5.6, 10), new THREE.MeshStandardMaterial({ color: 0x7a8a7b, roughness: 0.9 })); pillar.position.set(side * 4.7, 2.8, z); room.add(pillar);
        this.box(room, [0.85, 0.18, 0.85], [side * 4.7, 0.08, z], 0x859080);
      }
      this.box(room, [0.85, 2.5, 0.06], [side * 2.6, 3.2, -9.8], 0x426c78);
    }
    {
      this.box(room, [5.8, 0.16, 1.35], [0, 0.88, -2.5], 0x94876a);
      for (const x of [-2.3, 2.3]) this.box(room, [0.22, 0.85, 1.1], [x, 0.4, -2.5], 0x59695f);
      this.seat(room, -1.6, -3.65, 0x607b79); this.seat(room, 0, -3.65, 0x607b79); this.seat(room, 1.6, -3.65, 0x607b79);
      this.box(room, [1.5, 0.08, 0.7], [0, 0.65, 1.3], 0x897f65);
    }
  }
  update(state: PanelState) {
    const editingChanged = !!this.current.character !== !!state.character;
    if(editingChanged||this.current.discussion&&!state.discussion)this.director.reset();
    this.current = state;
    if (editingChanged && this.cast) this.setCast(...this.cast);
    this.rooms.discussion.visible = state.mode === 'discussion'; this.rooms.rehearsal.visible = state.mode === 'rehearsal';
    document.body.dataset.environment = state.mode;
    this.positionCharacters();
    this.avatars.forEach(item=>item.avatar.setFeature(state.character?.id===item.avatar.character.id?state.character.feature:undefined));
    const ctx = this.panelContext;
    ctx.fillStyle = '#142a29'; ctx.fillRect(0, 0, 1000, 500);
    ctx.strokeStyle = '#bca577'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 996, 496);
    ctx.fillStyle = '#cdb98e'; ctx.font = '22px sans-serif'; ctx.fillText('GAME OF CODES  /  SESSION SETUP', 40, 55);
    ctx.fillStyle = '#fff4dd'; ctx.font = '36px Georgia'; ctx.fillText((state.keyboard!==undefined?'Write an instruction':state.character?.name || state.title).slice(0, 44), 40, 119);
    const caption=!state.character&&state.guidance?state.guidance.caption:state.caption||state.status;
    ctx.fillStyle = '#d3ded0'; ctx.font = '24px sans-serif'; ctx.fillText((state.keyboard!==undefined?state.keyboard.slice(-60):caption).slice(0, 65), 40, 165);
    ctx.font = '20px sans-serif'; ctx.fillText(state.keyboard!==undefined?'':state.character ? state.character.code.slice(0, 75) : caption.slice(65,140), 40, 190);
    for (const button of this.interactiveButtons()) {
      const selected = button.action === state.mode;
      ctx.fillStyle = selected ? '#bca577' : '#29443d'; ctx.fillRect(button.x, button.y, button.width, button.height);
      ctx.fillStyle = selected ? '#142a29' : '#fff4dd'; ctx.font = `${button.height<60?18:22}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(button.label.slice(0,25), button.x + button.width / 2, button.y + button.height / 2 + 7); ctx.textAlign = 'left';
    }
    this.texture.needsUpdate = true;
    this.updateSurfaces();
  }
  private panelButtons(): Button[] {
    if(this.current.keyboard!==undefined)return [...'abcdefghijklmnopqrstuvwxyz'.split('').map((key,i)=>({x:40+(i%10)*93,y:205+Math.floor(i/10)*60,width:83,height:50,label:key.toUpperCase(),action:`key:${key}` as SceneAction})),{x:598,y:325,width:150,height:50,label:'Space',action:'key:space'},{x:758,y:325,width:200,height:50,label:'⌫',action:'key:back'},{x:40,y:402,width:210,height:60,label:'Send',action:'key:send'},{x:265,y:402,width:210,height:60,label:'Cancel',action:'key:cancel'},{x:490,y:402,width:210,height:60,label:'Interrupt',action:'ai:stop'},{x:715,y:402,width:245,height:60,label:'Leave VR',action:'exit'}];
    if(!this.current.character&&this.current.discussion)return [...this.current.discussion.choices.slice(0,4).map((c,i)=>({x:40+(i%2)*470,y:250+Math.floor(i/2)*85,width:450,height:70,label:c.label,action:`discuss:${c.action}` as SceneAction})),{x:40,y:200,width:170,height:42,label:'Speak',action:'ai:mic'},{x:230,y:200,width:170,height:42,label:'Type',action:'ai:type'},{x:420,y:200,width:170,height:42,label:'Interrupt',action:'discuss:pause'},{x:610,y:200,width:170,height:42,label:'Controls',action:'discuss:more'},{x:800,y:200,width:170,height:42,label:'Guide',action:'discuss:help'},{x:40,y:430,width:200,height:50,label:'Quiet',action:'ai:quiet'},{x:260,y:430,width:200,height:50,label:'Repeat',action:'ai:repeat'},{x:480,y:430,width:220,height:50,label:'Stop',action:'discuss:stop'},{x:730,y:430,width:230,height:50,label:'Leave VR',action:'exit'}];
    if(!this.current.character&&this.current.guidance)return [...this.current.guidance.choices.slice(0,4).map((c,i)=>({x:40+(i%2)*470,y:250+Math.floor(i/2)*85,width:450,height:70,label:c.label,action:`guide:${c.action}` as SceneAction})),{x:40,y:200,width:170,height:42,label:'Speak',action:'ai:mic'},{x:230,y:200,width:170,height:42,label:'Type',action:'ai:type'},{x:420,y:200,width:170,height:42,label:'Interrupt',action:'guide:pause'},{x:610,y:200,width:170,height:42,label:'Notes',action:'guide:notes'},{x:800,y:200,width:170,height:42,label:'Help',action:'guide:help'},{x:40,y:430,width:200,height:50,label:'Quiet',action:'ai:quiet'},{x:260,y:430,width:200,height:50,label:'Repeat',action:'ai:repeat'},{x:480,y:430,width:220,height:50,label:'Characters',action:'characters'},{x:730,y:430,width:230,height:50,label:'Leave VR',action:'exit'}];
    if (!this.current.character) return [...buttons.filter(b=>b.action!=='characters'),{x:40,y:195,width:160,height:44,label:'Speak',action:'ai:mic'},{x:215,y:195,width:160,height:44,label:'Type',action:'ai:type'},{x:390,y:195,width:160,height:44,label:'Interrupt',action:'ai:stop'},{x:565,y:195,width:160,height:44,label:'Repeat',action:'ai:repeat'},{x:740,y:195,width:220,height:44,label:'Characters',action:'characters'},{x:530,y:15,width:100,height:50,label:'Quiet',action:'ai:quiet'},{x:650,y:15,width:90,height:50,label:'‹',action:'ai:previous'},{x:760,y:15,width:90,height:50,label:'›',action:'ai:next'}];
    const character = this.current.character;
    if(character.buttons)return [...character.buttons,{x:890,y:15,width:90,height:50,label:'Exit',action:'exit'}];
    return [
      { x: 40, y: 255, width: 285, height: 76, label: 'Reroll appearance', action: 'character:reroll' },
      { x: 357, y: 255, width: 285, height: 76, label: 'Save character', action: 'character:save' },
      { x: 675, y: 255, width: 285, height: 76, label: 'Next character', action: 'character:next' },
      { x: 40, y: 365, width: 285, height: 74, label: character.guide ? 'New character' : character.inCast ? 'Remove from cast' : 'Add to cast', action: character.guide ? 'character:new' : 'character:cast' },
      { x: 357, y: 365, width: 285, height: 74, label: character.discardPending ? 'Discard changes' : 'Back to room', action: 'character:close' },
      { x: 675, y: 365, width: 285, height: 74, label: 'Leave VR', action: 'exit' },
    ];
  }
  private interactiveButtons(){const list=this.panelButtons();if(this.menuOpen&&!this.current.character&&this.current.keyboard===undefined)list.push({x:890,y:15,width:90,height:50,label:'Close',action:'court:close' as SceneAction},{x:350,y:15,width:165,height:50,label:document.body.dataset.sessionLanguage==='hi'?'English':'हिन्दी',action:'ai:language'},{x:520,y:15,width:120,height:50,label:'News',action:'guide:news'});return document.body.dataset.avatarErrors&&document.body.dataset.avatarErrors!=='0'?[...list.filter(b=>!(b.y===15&&b.x>=630&&b.x<880)),{x:650,y:15,width:220,height:50,label:'Retry avatar',action:'ai:avatar-retry' as SceneAction}]:list;}
  private selectPanel(x: number, y: number) {
    const button = this.interactiveButtons().find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
    if (button && (!this.current.busy || button.action === 'exit'||button.action==='ai:stop')) { this.flashUntil = performance.now() + 150; this.surfaceAction(button.action); }
  }
  private characterTargets(){return [...this.avatars.values()].flatMap(item=>this.current.character?.id===item.avatar.character.id?item.avatar.featureTargets:[item.avatar.hitbox,...item.avatar.featureTargets]);}
  private intersection(controller: THREE.Group) {
    controller.updateWorldMatrix(true, false);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).transformDirection(controller.matrixWorld);
    return this.raycaster.intersectObjects([this.panel,...Object.values(this.surfaces).filter(s=>s.mesh.visible).map(s=>s.mesh), ...this.characterTargets()].filter(o=>o.visible), false).find(hit=>{const surface=Object.values(this.surfaces).find(s=>s.mesh===hit.object);return !surface||!!hit.uv&&!!surface.hit(hit.uv);});
  }
  async enter() {
    if (!navigator.xr) throw new Error('Open this page in a WebXR-capable headset browser to enter VR.');
    const session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    try { await this.renderer.xr.setSession(session); } catch (error) { await session.end(); throw error; }
  }
  async exit() { await this.renderer.xr.getSession()?.end(); }
  private resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height || this.renderer.xr.isPresenting) return;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  private animate = (time: number) => {
    if (this.disposed || !this.active && time - this.lastRender < 33) return;
    const dt=this.lastRender?(time-this.lastRender)/1000:.033;
    if(this.lastRender)this.frameIntervals.push(time-this.lastRender);if(this.frameIntervals.length>120)this.frameIntervals.shift();this.lastRender = time;
    const court=this.current.court,speaker=this.avatars.get(court?.speakerId||'')?.avatar.group,other=this.avatars.get(court?.respondingTo||'')?.avatar.group;
    this.director.update(dt,this.active,!!this.current.discussion&&!this.current.character,court?.phase==='Thinking'?'':court?.turnId||'',speaker?.position,other?.position);
    document.body.dataset.cameraMode=this.active?'headset':this.director.enabled?'broadcast':'manual';document.body.dataset.cameraShot=this.director.shot;const cameraButton=document.querySelector<HTMLButtonElement>('#camera-mode');if(cameraButton){cameraButton.textContent=this.director.enabled?'TV camera':'Manual view';cameraButton.setAttribute('aria-pressed',String(this.director.enabled));}
    this.camera.getWorldPosition(this.viewer);
    const speech = this.speech?.(), level = speech ? Math.round(speech.mouth.open * 10) / 10 : 0;
    if (level !== this.speechLevel) document.body.dataset.speechLevel = String(this.speechLevel = level); // Observable lip-sync for browser checks.
    this.avatars.forEach(item => {const own=court?.speakerId===item.avatar.character.id,state=own&&(court?.phase==='Speaking'||court?.phase==='Ready'&&court?.status==='running'&&court?.turnId)?'Speaking':own&&court?.phase==='Thinking'?'Thinking':own&&/Error|unavailable/.test(court?.phase||'')?'Unavailable':this.current.discussion?'Listening':'Ready';const avatar=item.avatar as RealisticAvatar;avatar.setPresence(state,court?.selectedId===avatar.character.id||own&&['Speaking','Thinking'].includes(state));avatar.setTurnKind(court?.turnKind||'opening');avatar.setRoom(court?.showRoom||'conference');const attention=!own&&speaker&&this.current.discussion?speaker.position.clone().setY(1.2):this.viewer;avatar.animate(time,attention,speech?.id === avatar.character.id ? speech.mouth : undefined);});
    if(this.frameCount%15===0){this.camera.updateMatrixWorld();const vp=new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);document.body.dataset.courtCamera=JSON.stringify({position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),fov:this.camera.fov,viewProjection:vp.toArray()});document.body.dataset.courtActors=JSON.stringify([...this.avatars.values()].map(({avatar,kind})=>({id:avatar.character.id,kind,...(avatar as RealisticAvatar).poseSnapshot(),attentionTo:avatar.character.id===court?.speakerId?'viewer':speaker?court?.speakerId:'viewer'})));document.body.dataset.conferenceSeats=String(this.conference.group.visible?[...this.avatars.values()].filter(i=>i.kind==='cast').length:0);}
    if (this.active) for (const { controller, cursor } of this.controllers) {
      const hit = this.intersection(controller); cursor.visible = !!hit;
      if (hit) { cursor.position.copy(hit.point); (cursor.material as THREE.MeshBasicMaterial).color.set(performance.now() < this.flashUntil ? 0xffffff : 0xf6deb1); }
    }
    const before=performance.now();this.renderer.render(this.scene, this.camera);this.frameSamples.push(performance.now()-before);if(this.frameSamples.length>120)this.frameSamples.shift();document.body.dataset.courtFrame=String(++this.frameCount);if(this.frameCount%90===0){const samples=[...this.frameSamples].sort((a,b)=>a-b),intervals=[...this.frameIntervals].sort((a,b)=>a-b);document.body.dataset.courtPerformance=JSON.stringify({mode:this.active?'xr':'desktop',renderCpuP50Ms:+samples[Math.floor(samples.length*.5)].toFixed(2),renderCpuP95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2),frameCadenceP95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(2),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});}
  };
  dispose() {
    this.disposed = true; this.resizeObserver.disconnect(); this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener('pointerup', this.pointerSelect);
    this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);this.canvas.removeEventListener('pointercancel',this.pointerCancel);this.canvas.removeEventListener('keydown',this.lookKey);
    this.avatars.forEach(item => { this.scene.remove(item.avatar.group); item.avatar.dispose(); }); this.avatars.clear();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
    this.texture.dispose();Object.values(this.surfaces).forEach(s=>s.texture.dispose());this.environment?.dispose(); this.renderer.dispose();
  }
}
