import * as THREE from 'three';
import {MOTION_BINDINGS,motionWindow} from '../shared/studio/motion-library.mjs';
import {DEFAULT_PARTNER_DX,STAND_Z,markWindow,stagePlan,stageSample,type StagePlan} from '../shared/studio/stage-paths.mjs';
import type {ActiveAction} from '../shared/studio/performance.mjs';

type Clip={durationMs:number;frames:number;directions:number[];palms:number[];hips:number[];across:number[]};
type Bank={schemaVersion:number;bones:string[];clips:Record<string,Clip>};
let bank:Bank|null=null,pending:Promise<Bank>|null=null;
export function loadStudioMotions(){if(bank)return Promise.resolve(bank);return pending||=(async()=>{try{const response=await fetch('/motions/rocketbox/body.json');if(!response.ok)throw new Error('Motion library unavailable');const value:Bank=await response.json();if(value.schemaVersion!==1||!value.bones.length||!Object.keys(value.clips).length)throw new Error('Invalid motion library');bank=value;return value;}catch(error){pending=null;throw error;}})();}
export const studioMotionsReady=()=>!!bank;

type Rig={group:THREE.Group;bone:(name:string)=>THREE.Bone|undefined;aim:(bone:THREE.Bone,child:THREE.Object3D,direction:THREE.Vector3)=>void;twist:(bone:THREE.Bone,child:THREE.Object3D,index:THREE.Object3D,pinky:THREE.Object3D,direction:THREE.Vector3)=>void;turn:(name:string,axis:THREE.Vector3,angle:number)=>void};
type Side='L'|'R';
export type StagePosture={stand:number;jump:number;rootY:number;yaw:number;back:number;x:number;away:number};
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const children:Record<string,string>={Pelvis:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:'HeadNub','L Clavicle':'L UpperArm','R Clavicle':'R UpperArm','L UpperArm':'L Forearm','R UpperArm':'R Forearm','L Forearm':'L Hand','R Forearm':'R Hand','L Hand':'L Finger2','R Hand':'R Finger2','L Thigh':'L Calf','R Thigh':'R Calf','L Calf':'L Foot','R Calf':'R Foot','L Foot':'L Toe0','R Foot':'R Toe0'};
const smooth=(a:number,b:number,t:number)=>{const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
const between=(t:number,a:number,b:number,edge=.08)=>smooth(a-edge,a,t)*(1-smooth(b,b+edge,t));
const envelope=(a:ActiveAction)=>a.envelope??Math.sin(Math.PI*a.progress)**.4;
// Full contacts at the normal preview intensity; quieter and reduced-motion
// cues blend towards rest instead of reaching the same full hand pose.
const contactEnvelope=(a:ActiveAction)=>Math.min(envelope(a),Math.max(0,a.intensity)/.8);
const track=(values:number[],frame:number,stride:number,offset=0,loop=0)=>{const i=Math.floor(frame),t=frame-i,count=values.length/stride,out=new THREE.Vector3();for(let axis=0;axis<3;axis++){const raw=(n:number)=>values[(loop?((n%loop)+loop)%loop:Math.max(0,Math.min(count-1,n)))*stride+offset+axis],value=(n:number)=>(raw(n-2)+2*raw(n-1)+3*raw(n)+2*raw(n+1)+raw(n+2))/9,a=value(i-1),b=value(i),c=value(i+1),d=value(i+2);out.setComponent(axis,.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));}return out;};
const headOnly=(id:string)=>/^(response\.(nod|shake-head|concede-point|reluctantly-agree|dismiss-argument)|listening\.(attentive-nod|acknowledge-point)|presence\.glance-around)$/.test(id);
const quietArms=(id:string)=>headOnly(id)||/^(expression\.|response\.(raise-eyebrow|sceptical-look|look-to-host)|social\.knowing-glance|debate\.turn-away|listening\.(?!thoughtful-pause)|presence\.(breathe|blink|shift-weight|adjust-posture|glance-around)|comedy\.(smirk|chuckle|laugh|deadpan-stare|double-take|wink-at-camera|side-eye)|celebration\.shoulder-groove|fatigue\.(slump|drooping-eyelids|nod-off)|drama\.(freeze-disbelief|dramatic-pause|exaggerated-sigh|slow-turn-to-camera))/.test(id);
// Contacts that need the furniture in front of a seated person.
const DESK_CONTACTS=new Set(['sleep','rest-elbows','lean-on-desk','tap-table','tap-fingers','check-time','cup','microphone','mic-drop','notes','write','laptop','point-down']);
const RIGHT_ONLY=new Set(['facepalm','glasses','chin','chin-touch','raise-hand','raise-finger','stop-hand','point-down','cup','fist','thumbs-up','thumbs-down','wave','blow-kiss','salute','ok-sign','peace-sign','chef-kiss','shush','hand-on-heart','beckon','call-me','cover-mouth','neck-rub','object','tap-fingers']);
const LEFT_ONLY=new Set(['microphone','check-time','mic-drop']);
const windows=new WeakMap<Clip,Map<string,{startMs:number;speed:number}>>();
const FIST=[.55,1.3,1.4,1.4,1.35],OPEN=[.12,.04,.05,.07,.1],RELAXED=[.3,.22,.28,.34,.4],POINT=[.85,0,1.4,1.45,1.4];
const v3=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const mix=(a:number[],b:number[],t:number)=>a.map((value,i)=>value+(b[i]-value)*t);

export class StudioMotionRig{
  readonly props=new THREE.Group();
  private cup=new THREE.Group();private notes=new THREE.Group();private mic=new THREE.Group();private micBody=new THREE.Group();private pen=new THREE.Group();private laptop=new THREE.Group();private lid=new THREE.Group();private watch=new THREE.Group();
  private contactStrength=1;private materials:THREE.Material[]=[];private geometries:THREE.BufferGeometry[]=[];
  private yaw=new THREE.Quaternion();private seatShift=new THREE.Vector3();private plans=new Map<string,StagePlan>();
  constructor(private rig:Rig){
    rig.group.add(this.props);this.props.visible=false;this.props.add(this.cup,this.notes,this.mic,this.micBody,this.pen,this.laptop,this.watch);
    const mesh=(geometry:THREE.BufferGeometry,colour:number,parent:THREE.Object3D,at:[number,number,number],metalness=0)=>{const material=new THREE.MeshStandardMaterial({color:colour,roughness:.55,metalness});this.materials.push(material);this.geometries.push(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(...at);parent.add(m);return m;};
    mesh(new THREE.CylinderGeometry(.044,.034,.105,16,1,true),0xd7d4c6,this.cup,[0,.053,0]);mesh(new THREE.TorusGeometry(.042,.003,6,16),0xd7d4c6,this.cup,[0,.106,0]).rotation.x=Math.PI/2;mesh(new THREE.CircleGeometry(.040,16),0x658994,this.cup,[0,.089,0]).rotation.x=-Math.PI/2;const handle=mesh(new THREE.TorusGeometry(.028,.007,7,14),0xd7d4c6,this.cup,[.052,.063,0]);handle.rotation.y=Math.PI/2;
    for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(.22,.002,.17),0xf0e4ca,this.notes,[0,i*.002,0]);for(let i=0;i<4;i++)mesh(new THREE.BoxGeometry(.145,.001,.002),0x596575,this.notes,[0,.006,-.045+i*.022]);
    mesh(new THREE.CylinderGeometry(.019,.016,.13,12),0x17222b,this.micBody,[0,0,0]);mesh(new THREE.SphereGeometry(.023,12,8),0x303c46,this.micBody,[0,.067,0]);mesh(new THREE.CylinderGeometry(.008,.008,.11,8),0xb69d74,this.mic,[0,.045,0]);mesh(new THREE.CylinderGeometry(.045,.045,.009,16),0x243140,this.mic,[0,0,0]);
    const p=mesh(new THREE.CylinderGeometry(.004,.004,.14,8),0x233848,this.pen,[0,0,0]);p.rotation.z=.65;
    mesh(new THREE.BoxGeometry(.33,.018,.23),0x263343,this.laptop,[0,.009,0]);mesh(new THREE.BoxGeometry(.25,.002,.10),0x758597,this.laptop,[0,.02,-.025]);this.lid.position.set(0,.018,.11);this.laptop.add(this.lid);mesh(new THREE.BoxGeometry(.33,.21,.012),0x172332,this.lid,[0,.105,0]);mesh(new THREE.PlaneGeometry(.28,.16),0x416c8b,this.lid,[0,.105,-.007]).rotation.y=Math.PI;
    const band=mesh(new THREE.TorusGeometry(.025,.006,6,12),0x17222b,this.watch,[0,0,0]);band.rotation.x=Math.PI/2;mesh(new THREE.BoxGeometry(.035,.009,.029),0xc6b17c,this.watch,[0,.023,0],.65);
  }

  // Routes are planned once per context; partners share the lead's cue clock.
  private stage(action:ActiveAction){
    const definition=MOTION_BINDINGS[action.actionId];if(definition?.mode!=='stage')return null;
    const context={dx:action.stage?.dx??DEFAULT_PARTNER_DX,role:action.stage?.role??'lead',swap:!!action.stage?.swap,worldX:Math.round(this.rig.group.position.x*100)/100},key=action.actionId+JSON.stringify(context);
    let plan=this.plans.get(key);if(!plan){plan=stagePlan(action.actionId,context)!;if(this.plans.size>64)this.plans.clear();this.plans.set(key,plan);}
    const duration=action.durationMs||definition.durationMs,elapsed=action.elapsedMs??action.progress*duration,progress=Math.min(1,elapsed*Math.max(1,plan.durationMs/duration)/plan.durationMs);
    return {plan,progress,sample:stageSample(plan,progress),window:(from:string,to:string,ease?:number)=>markWindow(plan!,progress,from,to,ease)};
  }

  posture(actions:ActiveAction[]):StagePosture{
    let stand=0,jump=0,rootY=0,yaw=0,back:number|null=null,x=0,away=0;
    for(const action of actions){const definition=MOTION_BINDINGS[action.actionId];if(definition?.mode==='standing')stand=Math.max(stand,smooth(0,.23,action.progress)*(1-smooth(.77,1,action.progress)));if(definition?.mode==='sit-transition')stand=Math.max(stand,smooth(0,.18,action.progress)*(1-smooth(.30,.85,action.progress)));if(definition?.pose==='jump'){const flight=(action.progress-.34)/.32;if(flight>0&&flight<1)jump=(action.actionId==='movement.hop'?.12:.28)*4*flight*(1-flight)*(action.motionScale??1);}
      if(action.actionId==='movement.turn')yaw=.65*smooth(0,.45,action.progress)*(1-smooth(.65,1,action.progress));
      if(definition?.mode==='standing'&&definition.clip&&bank){const clip=bank.clips[definition.clip];if(clip&&action.actionId!=='movement.stand'&&action.actionId!=='debate.push-chair-back'){const frame=this.phase(action,clip)*(clip.frames-1),i=Math.floor(frame),j=Math.min(clip.frames-1,i+1),height=THREE.MathUtils.lerp(clip.hips[i*3+1]||0,clip.hips[j*3+1]||0,frame-i);rootY=Math.max(-.38,Math.min(.18,height))*envelope(action);}}
      const route=this.stage(action);if(route){const s=route.sample;stand=Math.max(stand,s.stand);x=s.x;back=s.z;yaw=s.yaw;away=smooth(.12,.4,Math.hypot(s.x,s.z-STAND_Z));
        // Fainting drops the last few centimetres into the chair rather than sitting.
        if(action.actionId==='drama.pretend-faint')rootY-=.03*route.window('fall','recover',250);}
    }
    return {stand,jump,rootY,yaw,back:back??-.25*stand,x,away};
  }

  private phase(action:ActiveAction,clip:Clip){const duration=action.durationMs||2800,elapsed=action.elapsedMs??action.progress*duration,key=duration+':'+headOnly(action.actionId);let cache=windows.get(clip);if(!cache){cache=new Map();windows.set(clip,cache);}let window=cache.get(key);if(!window){window=motionWindow(clip,bank!.bones,duration,headOnly(action.actionId));cache.set(key,window);}return Math.min(1,(window.startMs+elapsed*window.speed)/clip.durationMs);}
  hasNative(actionId:string){return !!bank&&!!MOTION_BINDINGS[actionId]?.clip;}
  private local(name:string){const b=this.rig.bone(name);return b?this.props.worldToLocal(b.getWorldPosition(new THREE.Vector3())):new THREE.Vector3(0,1.1,0);}
  private world(point:THREE.Vector3){return this.rig.group.localToWorld(point.clone());}
  // Body-frame vectors (+z the way this person faces) in world space. The props
  // frame is world-aligned, so this also converts body offsets for hand targets.
  private direction(vector:THREE.Vector3){return vector.applyQuaternion(this.yaw).applyQuaternion(this.rig.group.getWorldQuaternion(new THREE.Quaternion()));}
  private rel(x:number,y:number,z:number){return this.direction(v3(x,y,z));}
  private toBody(vector:THREE.Vector3){return vector.clone().applyQuaternion(this.rig.group.getWorldQuaternion(new THREE.Quaternion()).multiply(this.yaw).invert());}

  private native(action:ActiveAction,seated:boolean,energy:number){
    const definition=MOTION_BINDINGS[action.actionId],clip=definition?.clip&&bank?.clips[definition.clip];if(!clip||!bank||action.intensity<.0001)return;
    const f=this.phase(action,clip)*(clip.frames-1),route=this.stage(action),gate=route?route.window('dance','danced',600):1,weight=Math.min(.72,action.intensity*(.8+energy*.25))*Math.min(1,(action.durationMs||2800)/1400)*gate,stride=bank.bones.length*3;if(weight<.001)return;
    for(const [index,name] of bank.bones.entries()){
      if(headOnly(action.actionId)&&!['Head','Neck'].includes(name))continue;
      if(quietArms(action.actionId)&&/^[LR] (Clavicle|UpperArm|Forearm|Hand)$/.test(name))continue;
      if(seated&&definition.mode==='seated'&&/^(Pelvis|[LR] (Thigh|Calf|Foot))$/.test(name))continue;
      if(/look-between|look-to-host|knowing-glance/.test(action.actionId)&&['Head','Neck'].includes(name))continue;
      const bone=this.rig.bone(name),child=this.rig.bone(children[name]);if(!bone||!child)continue;
      const vector=track(clip.directions,f,stride,index*3).normalize(),before=bone.quaternion.clone();this.rig.aim(bone,child,this.direction(vector));
      if(name==='L Hand'||name==='R Hand'){const side=name[0],finger=this.rig.bone(side+' Finger2'),indexBone=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4');if(finger&&indexBone&&pinky){const palm=track(clip.palms,f,6,side==='L'?0:3).normalize();this.rig.twist(bone,finger,indexBone,pinky,this.direction(palm));}}
      if(name==='Pelvis'&&clip.across){const left=this.rig.bone('L Thigh'),right=this.rig.bone('R Thigh');if(left&&right){const across=track(clip.across,f,3).normalize();this.rig.twist(bone,child,left,right,this.direction(across));}}
      const torso=seated&&definition.mode==='seated'&&/^(Spine|Spine1|Spine2|[LR] Clavicle)$/.test(name)?.35:1,blend=/^(Pelvis|[LR] (Thigh|Calf|Foot))$/.test(name)&&definition.mode!=='seated'?weight*this.posture([action]).stand:weight*torso;bone.quaternion.slerpQuaternions(before,bone.quaternion.clone(),blend);bone.updateMatrixWorld(true);
    }
  }

  // The Rocketbox walk cycle, phase-locked to distance travelled so feet do not skate.
  private walkCycle(weight:number,stride:number,lean=0){
    const clip=bank?.clips.m_walk_neutral_01;if(!clip||!bank||weight<.001)return;
    const loop=clip.frames-1,f=((stride%1)+1)%1*loop,step=bank.bones.length*3;
    for(const [index,name] of bank.bones.entries()){
      const bone=this.rig.bone(name),child=this.rig.bone(children[name]);if(!bone||!child)continue;
      const vector=track(clip.directions,f,step,index*3,loop).normalize();if(lean&&/^Spine/.test(name))vector.applyAxisAngle(X,lean/3);
      const before=bone.quaternion.clone();this.rig.aim(bone,child,this.direction(vector));
      if(name==='L Hand'||name==='R Hand'){const side=name[0],finger=this.rig.bone(side+' Finger2'),indexBone=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4');if(finger&&indexBone&&pinky)this.rig.twist(bone,finger,indexBone,pinky,this.direction(track(clip.palms,f,6,side==='L'?0:3,loop).normalize()));}
      if(name==='Pelvis'){const left=this.rig.bone('L Thigh'),right=this.rig.bone('R Thigh');if(left&&right)this.rig.twist(bone,child,left,right,this.direction(track(clip.across,f,3,0,loop).normalize()));}
      bone.quaternion.slerpQuaternions(before,bone.quaternion.clone(),weight);bone.updateMatrixWorld(true);
    }
  }

  // Analytic two-bone IK keeps the destination avatar's own bone lengths.
  private hand(side:Side,target:THREE.Vector3,weight=1,hint?:THREE.Vector3){
    const upper=this.rig.bone(side+' UpperArm'),fore=this.rig.bone(side+' Forearm'),hand=this.rig.bone(side+' Hand');if(!upper||!fore||!hand||weight<=0)return;
    this.rig.group.updateMatrixWorld(true);const s=upper.getWorldPosition(new THREE.Vector3()),e=fore.getWorldPosition(new THREE.Vector3()),w=hand.getWorldPosition(new THREE.Vector3()),goal=w.clone().lerp(this.props.localToWorld(target.clone()),Math.min(1,weight)),l1=s.distanceTo(e),l2=e.distanceTo(w),d=THREE.MathUtils.clamp(s.distanceTo(goal),Math.abs(l1-l2)+.001,l1+l2-.003),axis=goal.clone().sub(s).normalize(),bend=hint?this.direction(hint.clone()):this.direction(new THREE.Vector3(side==='L'?.3:-.3,-1,-.15));bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<.001)bend.copy(this.direction(new THREE.Vector3(side==='L'?1:-1,0,0)));bend.normalize();goal.copy(s).addScaledVector(axis,d);
    const a=(l1*l1-l2*l2+d*d)/(2*d),elbow=s.clone().addScaledVector(axis,a).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-a*a))),orientation=hand.getWorldQuaternion(new THREE.Quaternion());
    this.rig.aim(upper,fore,elbow.clone().sub(s));this.rig.aim(fore,hand,goal.sub(elbow));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));hand.updateMatrixWorld(true);
  }

  // Fingers along `finger`, palm facing `palm`, both in the body frame.
  private orient(side:Side,finger:THREE.Vector3,palm:THREE.Vector3,weight=1){
    const hand=this.rig.bone(side+' Hand'),middle=this.rig.bone(side+' Finger2'),index=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4');if(!hand||!middle||!index||!pinky||weight<=0)return;
    const before=hand.quaternion.clone(),f=this.direction(finger.clone().normalize()),n=this.direction(palm.clone().normalize()),across=side==='R'?f.clone().cross(n):n.clone().cross(f);
    this.rig.aim(hand,middle,f);this.rig.twist(hand,middle,index,pinky,across);hand.quaternion.slerpQuaternions(before,hand.quaternion.clone(),Math.min(1,weight));hand.updateMatrixWorld(true);
  }

  // Places a hand so its wrist, or a named finger joint, reaches `target`.
  // `thumb` aims the thumb: a body-frame direction, 'open' (spread in the palm
  // plane) or 'along' the fingers. The rest thumb otherwise points into the palm.
  private place(side:Side,target:THREE.Vector3,finger:THREE.Vector3,palm:THREE.Vector3,curls:number[],weight:number,{tip,tipWeight=1,hint,thumb}:{tip?:string;tipWeight?:number;hint?:THREE.Vector3;thumb?:THREE.Vector3|'open'|'along'}={}){
    if(weight<=0)return;const start=this.local(side+' Hand');let goal=target.clone();
    for(let pass=0;pass<(tip?3:1);pass++){
      this.hand(side,start.clone().lerp(goal,Math.min(1,weight)),1,hint);this.orient(side,finger,palm,weight);this.digits(side,curls,weight);
      if(thumb){const f=finger.clone().normalize(),n=palm.clone().normalize(),across=side==='R'?f.clone().cross(n):n.clone().cross(f);this.thumb(side,thumb==='open'?across.multiplyScalar(.75).addScaledVector(f,.6).addScaledVector(n,-.2):thumb==='along'?f.addScaledVector(across,.25):thumb.clone(),weight);}
      if(tip)goal=target.clone().sub(this.local(`${side} ${tip}`).sub(this.local(side+' Hand')).multiplyScalar(tipWeight));
    }
  }
  private thumb(side:Side,direction:THREE.Vector3,weight:number){
    const world=this.direction(direction.clone().normalize());
    for(const name of ['Finger0','Finger01','Finger02']){const bone=this.rig.bone(`${side} ${name}`),child=bone?.children[0];if(!bone||!child)continue;const before=bone.quaternion.clone();this.rig.aim(bone,child,world.clone());bone.quaternion.slerpQuaternions(before,bone.quaternion.clone(),Math.min(1,weight));bone.updateMatrixWorld(true);}
  }

  settleHands(actions:ActiveAction[],seatStyle:number,seated:boolean,stand:number){
    if(!seated||stand>=1)return;
    for(const side of ['L','R'] as const){
      const lap=seatStyle===1&&side==='R'||seatStyle===2&&side==='L',x=(side==='L'?1:-1)*.18,goal=new THREE.Vector3(x,lap?.72:.92,lap?.15:seatStyle===3?.36:.38).add(this.seatShift);
      const speech=actions.find(action=>/^(speaking\.(open-palms|spread-arms|explain-one-hand|emphasise-word|gesture-to-person)|response\.shrug|social\.(introduce-guest|invite-speaker|offer-help|yield-floor|reassure))$/.test(action.actionId));
      if(speech&&stand<.01){
        // Standing presentation clips put a seated wrist beside the chair.
        // Give conversational gestures a continuous path above the desk while
        // retaining the clip's head, shoulders and torso performance.
        const both=/open-palms|spread-arms|shrug/.test(speech.actionId),left=/yield-floor|reassure/.test(speech.actionId),owned=both||(left?side==='L':side==='R'),env=envelope(speech),strength=env?Math.min(1,speech.intensity/env):0;
        if(owned){const beat=Math.sin(Math.PI*speech.progress),spread=speech.actionId==='speaking.spread-arms'?.40:both?.30:.25,target=new THREE.Vector3((side==='L'?1:-1)*spread,1.04+(/emphasise/.test(speech.actionId)?.08*beat:.035*beat),.46+.025*beat);goal.lerp(target,env*strength);}
        this.hand(side,goal);this.flatHand(side);if(owned)this.openHand(side,env*strength);continue;
      }
      let release=stand;
      for(const action of actions){if(quietArms(action.actionId))continue;const definition=MOTION_BINDINGS[action.actionId],contact=definition?.contact;
        if(!contact&&!definition?.clip&&!definition?.stage)continue;const hands=this.handsFor(action);if(!hands.includes(side))continue;release=Math.max(release,contactEnvelope(action));}
      const weight=1-release;if(weight<=0)continue;
      this.hand(side,goal,weight);if(!lap)this.flatHand(side,weight);
    }
  }
  private handsFor(action:ActiveAction):Side[]{
    const contact=MOTION_BINDINGS[action.actionId]?.contact||'';if(contact==='point')return [(action.stage?.dx??-1)>0?'L':'R'];
    return RIGHT_ONLY.has(contact)?['R']:LEFT_ONLY.has(contact)?['L']:['L','R'];
  }

  // Per-finger curl in radians per segment: thumb, index, middle, ring, little.
  private digits(side:Side,curls:number[],weight=1){
    const hand=this.rig.bone(side+' Hand'),index=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4'),middle=this.rig.bone(side+' Finger2');if(!hand||!index||!pinky||!middle||weight<=0)return;
    const across=index.getWorldPosition(new THREE.Vector3()).sub(pinky.getWorldPosition(new THREE.Vector3())),forward=middle.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3())),palm=across.cross(forward).normalize().multiplyScalar(side==='L'?-1:1);
    for(let finger=0;finger<5;finger++){const curl=(curls[finger]??0)*weight;if(Math.abs(curl)<.001)continue;const first=this.rig.bone(`${side} Finger${finger}`),next=first?.children[0];if(!first||!next)continue;const hinge=next.getWorldPosition(new THREE.Vector3()).sub(first.getWorldPosition(new THREE.Vector3())).cross(palm).normalize();for(let segment=0;segment<3;segment++){const bone=this.rig.bone(`${side} Finger${finger}${segment||''}`),child=bone?.children[0];if(bone&&child){const direction=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize().applyAxisAngle(hinge,curl*(finger===0?.45:1));this.rig.aim(bone,child,direction);}}}
  }
  private fingers(side:Side,curl:number,except=-1){this.digits(side,[0,1,2,3,4].map(n=>n===except?0:curl*this.contactStrength));}

  private gripHand(side:Side,weight:number,direction=-1){
    const hand=this.rig.bone(side+' Hand');if(!hand)return;this.flatHand(side);const yaw=new THREE.Quaternion().setFromAxisAngle(this.direction(Y.clone()),direction*Math.PI/2*weight),forward=this.direction(Z.clone()).applyQuaternion(yaw),roll=new THREE.Quaternion().setFromAxisAngle(forward,(side==='L'?-1:1)*Math.PI/2*weight),world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(yaw).premultiply(roll);hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  private flatHand(side:Side,weight=1){
    const hand=this.rig.bone(side+' Hand'),finger=this.rig.bone(side+' Finger2'),index=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4');if(hand&&finger){const before=hand.quaternion.clone(),orientation=this.props.getWorldQuaternion(new THREE.Quaternion());this.rig.aim(hand,finger,new THREE.Vector3(0,0,1).applyQuaternion(orientation));if(index&&pinky)this.rig.twist(hand,finger,index,pinky,new THREE.Vector3(side==='L'?-1:1,0,0).applyQuaternion(orientation));hand.quaternion.slerpQuaternions(before,hand.quaternion.clone(),weight);hand.updateMatrixWorld(true);}
  }

  private openHand(side:Side,weight:number){
    const hand=this.rig.bone(side+' Hand'),finger=this.rig.bone(side+' Finger2');if(!hand||!finger)return;const forward=this.direction(new THREE.Vector3(0,.2*weight,1).normalize());this.rig.aim(hand,finger,forward);const world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(forward,(side==='L'?1:-1)*Math.PI*weight));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  private uprightHand(side:Side,weight=1,palmIn=false,clap=false){
    const hand=this.rig.bone(side+' Hand');if(!hand)return;this.flatHand(side);const world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(this.direction(X.clone()),-Math.PI/2*weight));if(palmIn||clap)world.premultiply(new THREE.Quaternion().setFromAxisAngle(this.direction(Y.clone()),(side==='L'?-1:1)*(clap?Math.PI/2:Math.PI)*weight));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  plantFeet(targets:Record<string,number[]>,weight=1){
    for(const side of ['L','R']){const thigh=this.rig.bone(side+' Thigh'),calf=this.rig.bone(side+' Calf'),foot=this.rig.bone(side+' Foot'),toe=this.rig.bone(side+' Toe0'),position=targets[side];if(!thigh||!calf||!foot||!position||weight<=0)continue;this.rig.group.updateMatrixWorld(true);const s=thigh.getWorldPosition(new THREE.Vector3()),e=calf.getWorldPosition(new THREE.Vector3()),w=foot.getWorldPosition(new THREE.Vector3()),l1=s.distanceTo(e),l2=e.distanceTo(w),goal=w.clone().lerp(this.world(new THREE.Vector3().fromArray(position)),weight),axis=goal.clone().sub(s).normalize(),d=THREE.MathUtils.clamp(s.distanceTo(goal),Math.abs(l1-l2)+.001,l1+l2-.003),hint=this.direction(new THREE.Vector3(0,0,1));hint.addScaledVector(axis,-hint.dot(axis)).normalize();goal.copy(s).addScaledVector(axis,d);const a=(l1*l1-l2*l2+d*d)/(2*d),knee=s.clone().addScaledVector(axis,a).addScaledVector(hint,Math.sqrt(Math.max(0,l1*l1-a*a)));this.rig.aim(thigh,calf,knee.clone().sub(s));this.rig.aim(calf,foot,goal.sub(knee));if(toe){const before=foot.quaternion.clone();this.rig.aim(foot,toe,this.direction(new THREE.Vector3(0,0,1)));foot.quaternion.slerpQuaternions(before,foot.quaternion.clone(),weight);foot.updateMatrixWorld(true);}}
  }

  apply(actions:ActiveAction[],energy:number,seated:boolean,seatStyle=0,stand=0){
    // Furniture props stay on the set when the host turns towards camera two.
    this.props.quaternion.copy(this.rig.group.quaternion).invert();this.props.updateWorldMatrix(true,true);
    const posture=this.posture(actions);this.yaw.setFromAxisAngle(Y,posture.yaw);this.seatShift.set(posture.x,0,0).applyQuaternion(this.rig.group.quaternion);
    this.props.visible=seated;this.cup.position.set(-.29,.855,.52);this.cup.rotation.set(0,0,0);this.notes.position.set(.02,.855,.52);this.notes.rotation.set(0,0,0);this.notes.visible=true;this.mic.position.set(.25,.855,.53);this.mic.rotation.set(0,0,0);this.micBody.position.copy(this.mic.position).y+=.16;this.micBody.rotation.set(0,0,0);this.pen.position.set(.15,.868,.48);this.pen.rotation.set(0,0,Math.PI/2-.65);this.laptop.visible=false;this.watch.visible=false;
    this.settleHands([],seatStyle,seated,stand);
    for(const action of actions){
      const route=this.stage(action);if(route)this.walkCycle(route.sample.walk*Math.min(1,action.intensity/Math.max(.01,envelope(action))||1),route.sample.stride,action.actionId==='drama.storm-off'?.16:action.actionId==='drama.return-sheepishly'?.12:0);
      this.native(action,seated,energy);const definition=MOTION_BINDINGS[action.actionId];if(!definition)continue;const k=action.intensity*(.8+energy*.35),p=action.progress,env=contactEnvelope(action),head=this.local('Head'),turn=this.rig.turn;
      switch(definition.pose){
        case 'tilt':turn('Head',Z,.12*k);turn('Neck',X,.06*k);break;
        case 'glance':turn('Head',Y,(action.targetId?.08:.25)*k*Math.sin(p*Math.PI));break;
        case 'double-take':turn('Head',Y,k*(-.35*smooth(0,.22,p)+.65*smooth(.3,.56,p)));turn('Neck',Z,.045*k);turn('Spine2',X,-.06*k*smooth(.3,.5,p));break;
        case 'turn':if(action.actionId==='drama.slow-turn-to-camera')break;turn('Spine2',Y,.25*k);turn('Neck',Y,.15*k);turn('Head',Y,.3*k);break;
        case 'expression':this.expressionBody(action.actionId,k,p);break;
        case 'bow':turn('Spine',X,.48*k);turn('Spine2',X,.3*k);turn('Head',X,.15*k);break;
        case 'jump':{const crouch=p<.34?smooth(.12,.28,p)*(1-smooth(.28,.34,p)):smooth(.62,.70,p)*(1-smooth(.70,.84,p)),bend=crouch*k,air=smooth(.30,.40,p)*(1-smooth(.60,.70,p));for(const side of ['L','R']){turn(side+' Thigh',X,-.38*bend);turn(side+' Calf',X,.64*bend);}turn('Spine2',X,.18*bend);
          // Arms swing back in the crouch and forwards on take-off.
          if(action.actionId!=='celebration.celebratory-jump'){turn('L UpperArm',X,(.35*bend-.55*air)*k);turn('R UpperArm',X,(.35*bend-.55*air)*k);}break;}
        case 'slump':turn('Spine',X,.12*k);turn('Spine2',X,.17*k);turn('Head',X,.26*k);break;
        case 'sleep':turn('Spine',X,.48*env);turn('Spine1',X,.32*env);turn('Spine2',X,.35*env);turn('Neck',X,.35*env);turn('Head',X,.22*env);break;
        case 'wake':{const asleep=smooth(0,.15,p)*(1-smooth(.35,.65,p))*env,recoil=p>.35?Math.sin((p-.35)*Math.PI*3)*k:0;turn('Spine',X,.48*asleep);turn('Spine1',X,.32*asleep);turn('Spine2',X,.35*asleep-.18*recoil);turn('Neck',X,.35*asleep);turn('Head',X,.22*asleep-.16*recoil);turn('L Clavicle',Z,.08*k);turn('R Clavicle',Z,-.08*k);break;}
        case 'sigh':{const inhale=smooth(.05,.35,p)*(1-smooth(.4,.6,p)),exhale=smooth(.45,.7,p)*(1-smooth(.85,1,p));turn('L Clavicle',Z,(.16*inhale-.06*exhale)*k);turn('R Clavicle',Z,(-.16*inhale+.06*exhale)*k);turn('Spine2',X,(-.06*inhale+.16*exhale)*k);turn('Head',X,(-.14*inhale+.14*exhale)*k);break;}
        case 'recover':turn('Head',Z,.07*k*Math.sin(p*Math.PI*3));turn('Head',X,.12*k);turn('Spine2',X,.07*k);break;
        case 'settle':{const shift=Math.sin(p*Math.PI);if(action.actionId==='presence.shift-weight'){turn('Spine',Z,.07*k*shift);turn('Spine2',Z,-.04*k*shift);turn('Head',Z,-.03*k*shift);}else{turn('Spine1',X,-.07*k*shift);turn('L Clavicle',Y,-.08*k*shift);turn('R Clavicle',Y,.08*k*shift);turn('Head',X,-.04*k*shift);}break;}
        case 'stretch':{const up=smooth(.1,.38,p)*(1-smooth(.72,.92,p));turn('Spine1',X,-.1*up*k);turn('Spine2',X,-.12*up*k);turn('Head',X,-.18*up*k);turn('Spine',Z,.05*up*k*Math.sin(p*Math.PI*2));break;}
        case 'think':turn('Head',Z,.06*k);turn('Head',X,-.06*k);turn('LEye',X,-.12*k);turn('REye',X,-.12*k);turn('Spine2',X,.04*k);break;
        case 'lean-in':turn('Spine',X,.1*k);turn('Spine2',X,.07*k);break;
        case 'lean-back':turn('Spine',X,-.06*k);turn('Spine2',X,-.05*k);turn('Head',X,-.05*k);break;
        case 'lean-on-desk':turn('Spine',X,.2*k);turn('Spine1',X,.1*k);turn('Head',X,-.12*k);break;
        case 'drop-head':turn('Head',X,.2*k);turn('Neck',X,.08*k);turn('Spine2',X,.06*k);break;
        case 'laugh':{const big=/laugh$/.test(action.actionId),bounce=Math.sin(p*Math.PI*(big?11:8)),back=action.actionId==='comedy.suppress-laughter'?.08:big?-.16:-.06;turn('Head',X,back*k*Math.sin(p*Math.PI));turn('Spine2',X,(.05*bounce+(big?-.05:0))*k);turn('L Clavicle',Z,.05*k*bounce);turn('R Clavicle',Z,-.05*k*bounce);break;}
        case 'groove':{const beat=p*Math.PI*10,bob=Math.sin(beat*2);turn('Head',X,.06*k*bob);turn('Head',Z,.05*k*Math.sin(beat));turn('Spine2',Z,.07*k*Math.sin(beat));turn('Spine',Y,.06*k*Math.sin(beat));turn('L Clavicle',Z,.09*k*Math.max(0,Math.sin(beat)));turn('R Clavicle',Z,-.09*k*Math.max(0,-Math.sin(beat)));break;}
        case 'proud':turn('Spine2',X,-.07*k);turn('Head',X,-.08*k);break;
        case 'nod-bow':turn('Head',X,.14*k*Math.sin(p*Math.PI));turn('Spine2',X,.06*k*Math.sin(p*Math.PI));break;
        case 'sob':{const shake=Math.sin(p*Math.PI*14);turn('Head',X,.24*k);turn('Spine2',X,(.12+.03*shake)*k);turn('L Clavicle',Z,.06*k*shake);turn('R Clavicle',Z,-.06*k*shake);break;}
      }
      if(route)this.stagePerformance(action,route,k,env,head);
      const contact=definition.contact;if(!contact||env<.001||DESK_CONTACTS.has(contact)&&!seated)continue;this.contactStrength=env;
      if(this.gesture(action,contact,k,env))continue;
      if(!seated)continue;
      const right=new THREE.Vector3(-.16,.94,.48),left=new THREE.Vector3(.16,.94,.48);let grip=env;
      if(contact==='raise-hand'||contact==='raise-finger'||contact==='stop-hand'||contact==='count'){
        this.hand('R',head.clone().add(new THREE.Vector3(-.28,contact==='raise-hand'?.32:-.08,.28)),grip);this.uprightHand('R',grip);if(contact==='raise-finger')this.fingers('R',.55,1);if(contact==='count'){this.fingers('R',.5,1+Math.min(3,Math.floor(p*4)));this.hand('L',head.clone().add(new THREE.Vector3(.13,-.22,.30)),grip);this.flatHand('L');this.openHand('L',grip*.8);}
      }else if(contact==='clap'||contact==='clap-overhead'){const spread=.035+.12*Math.sin(p*Math.PI*7)**2,y=contact==='clap-overhead'?head.y+.22:1.04;this.hand('R',new THREE.Vector3(-spread,y,.36),grip);this.hand('L',new THREE.Vector3(spread,y,.36),grip);this.uprightHand('R',grip,false,true);this.uprightHand('L',grip,false,true);}
      else if(contact==='sleep'){this.hand('R',new THREE.Vector3(-.12,.91,.56),grip);this.hand('L',new THREE.Vector3(.12,.91,.56),grip);}
      else if(contact==='tap-table'){right.y=left.y=.91+.09*Math.sin(p*Math.PI*3)**2;this.hand('R',right,grip);this.hand('L',left,grip);}
      else if(contact==='check-time'){this.hand('L',head.clone().add(new THREE.Vector3(.04,-.24,.34)),grip);this.flatHand('L',grip);this.watch.visible=grip>.1;this.watch.position.copy(this.local('L Hand')).add(new THREE.Vector3(0,.012,0));turn('Head',X,.14*k);}
      else if(contact==='cup'||contact==='microphone'){
        const cup=contact==='cup',side=cup?'R':'L',held=cup?this.cup:this.micBody,rest=held.position.clone(),lift=smooth(.24,.45,p)*(1-smooth(.66,.84,p)),mouth=head.clone().add(new THREE.Vector3(cup?-.06:.10,cup?-.14:-.07,.15));
        if(cup||action.actionId==='props.pick-up-microphone')held.position.lerpVectors(rest,mouth,lift*grip);
        else{held.rotation.x=.12*lift*grip;held.position.z-=.015*lift*grip;}
        if(cup)held.rotation.z=-.26*smooth(.45,.56,p)*(1-smooth(.60,.69,p));
        this.hand(side,held.position.clone().add(new THREE.Vector3(.085,cup?.065:-.025,cup?.015:.025)),grip);this.gripHand(side,grip);this.fingers(side,.68);
      }else if(contact==='notes'){
        const lift=smooth(.10,.3,p)*(1-smooth(.74,.94,p));this.notes.position.y+=.20*lift*grip;this.notes.position.z-=.10*lift*grip;this.notes.rotation.x=-.65*lift*grip;this.hand('R',this.notes.position.clone().add(new THREE.Vector3(-.14,.025,.02)),grip);this.hand('L',this.notes.position.clone().add(new THREE.Vector3(.14,.025,.02)),grip);this.gripHand('R',grip,1);this.gripHand('L',grip);this.fingers('R',.2);this.fingers('L',.2);if(action.actionId==='props.turn-page')this.notes.rotation.z=.06*Math.sin(p*Math.PI*4)*grip;
      }else if(contact==='write'){
        right.set(-.055+.025*Math.sin(p*30),.91,.50+.015*Math.sin(p*17));this.hand('R',right,grip);this.hand('L',new THREE.Vector3(.11,.91,.48),grip);this.pen.position.copy(right).add(new THREE.Vector3(.025,.003,0));this.pen.rotation.set(0,0,0);this.fingers('R',.35,1);
      }else if(contact==='laptop'){
        this.laptop.visible=true;this.laptop.position.set(0,.855,.53);this.lid.rotation.x=-Math.PI/2+(Math.PI/2+.12)*smooth(.05,.24,p)*(1-smooth(.82,.98,p));this.hand('R',new THREE.Vector3(-.10,.91,.48),grip);this.hand('L',new THREE.Vector3(.10,.91,.48),grip);this.fingers('R',.08*Math.sin(p*70));this.fingers('L',.08*Math.cos(p*63));
      }
      if(['sleep','tap-table','write','laptop'].includes(contact)){this.flatHand('R',grip);this.flatHand('L',grip);}
    }
    // Keep hands that reach over the actual tabletop above its solid surface.
    if(seated)for(const side of ['L','R'] as const){const h=this.local(side+' Hand').sub(this.seatShift),weight=smooth(.30,.43,h.z)*(1-smooth(1.35,1.50,h.z))*(1-smooth(.60,.75,Math.abs(h.x)));if(weight>0&&h.y<.90)this.hand(side,new THREE.Vector3(h.x,.90,h.z).add(this.seatShift),weight);}
  }

  // Facial expressions are carried by the head and shoulders as well as the
  // reduced face rig, so they still read in mid and wide shots.
  private expressionBody(id:string,k:number,p:number){
    const turn=this.rig.turn,peak=Math.sin(Math.PI*p);
    switch(id){
      case 'expression.smile':turn('Head',Z,.04*k);turn('Head',X,-.03*k);break;
      case 'expression.grin':turn('Head',Z,.06*k);turn('Head',X,-.06*k);turn('Spine2',X,-.03*k);break;
      case 'expression.frown':case 'expression.concern':turn('Head',X,.07*k);turn('Spine',X,.05*k);if(id==='expression.concern')turn('Head',Z,.06*k);break;
      case 'expression.embarrassment':turn('Head',X,.16*k);turn('Head',Y,.22*k);turn('L Clavicle',Z,.07*k);turn('R Clavicle',Z,-.07*k);break;
      case 'expression.surprise':case 'expression.jaw-drop':{const jolt=smooth(0,.12,p);turn('Head',X,-.12*k*jolt);turn('Spine2',X,-.08*k*jolt);turn('L Clavicle',Z,.09*k*jolt);turn('R Clavicle',Z,-.09*k*jolt);break;}
      case 'expression.confusion':turn('Head',Z,.13*k);turn('Head',Y,-.06*k);turn('Spine2',X,.04*k);break;
      case 'expression.frustration':turn('Head',X,.06*k);turn('Head',Y,.1*k*Math.sin(p*Math.PI*3));turn('L Clavicle',Z,.07*k*peak);turn('R Clavicle',Z,-.07*k*peak);break;
      case 'expression.disbelief':turn('Head',Y,.17*k*Math.sin(p*Math.PI*3));turn('Spine2',X,-.06*k);break;
      case 'expression.eye-roll':{const roll=smooth(.15,.4,p)*(1-smooth(.65,.9,p));turn('LEye',X,-.3*k*roll);turn('REye',X,-.3*k*roll);turn('Head',X,-.08*k*roll);turn('Head',Z,.08*k*roll);break;}
      case 'expression.relief':{const drop=smooth(.2,.6,p);turn('L Clavicle',Z,(.06*peak-.08*drop)*k);turn('R Clavicle',Z,(-.06*peak+.08*drop)*k);turn('Head',X,(-.1*peak+.08*drop)*k);break;}
      case 'expression.disgust':turn('Spine2',X,-.05*k);break;
      case 'expression.wink':case 'comedy.wink-at-camera':turn('Head',Z,.09*k*peak);turn('Head',X,.04*k*peak);break;
      case 'expression.squint':turn('Spine',X,.06*k);turn('Head',X,.04*k);break;
      case 'expression.pout':case 'expression.puppy-eyes':turn('Head',Z,.1*k);turn('Head',X,.08*k);if(id==='expression.puppy-eyes'){turn('LEye',X,-.1*k);turn('REye',X,-.1*k);}break;
      case 'expression.eyebrow-flash':turn('Head',X,-.05*k*Math.sin(p*Math.PI*4)**2);break;
      case 'comedy.side-eye':{const look=smooth(.1,.3,p)*(1-smooth(.75,.95,p));turn('LEye',Y,.38*k*look);turn('REye',Y,.38*k*look);turn('Head',Y,-.12*k*look);turn('Head',Z,-.04*k*look);break;}
      case 'comedy.smirk':case 'response.raise-eyebrow':turn('Head',Z,-.06*k);turn('Head',X,-.03*k);break;
      case 'comedy.mock-shock':turn('Spine2',X,-.1*k);turn('Head',X,-.06*k);break;
      case 'fatigue.drooping-eyelids':turn('Head',X,.1*k*smooth(.2,.8,p));break;
    }
  }

  // Authored hand shapes. Offsets are body-frame metres from the head or chest
  // joints; `m` mirrors an offset for the left hand. Returns false when the
  // contact is a desk interaction handled by the caller.
  private gesture(action:ActiveAction,contact:string,k:number,w:number){
    // Read after the body pose so hands follow a head that leaned or dropped.
    const p=action.progress,head=this.local('Head'),chest=this.local('Spine2'),H=(x:number,y:number,z:number)=>head.clone().add(this.rel(x,y,z)),C=(x:number,y:number,z:number)=>chest.clone().add(this.rel(x,y,z)),both=(fn:(side:Side,m:number)=>void)=>{fn('R',-1);fn('L',1);},beat=(n:number)=>Math.sin(p*Math.PI*n)**2,turn=this.rig.turn;
    switch(contact){
      case 'heart':both((side,m)=>this.place(side,C(m*.085,.1+.008*Math.sin(p*Math.PI*8),.3),v3(-m*.72,.68,0),v3(-m*.15,0,-1),[0,.95,1.0,1.05,1.1],w,{hint:v3(m*.6,-.8,-.1),thumb:v3(-m*.6,-.8,.05)}));turn('Head',Z,.07*k);break;
      case 'thumbs-up':case 'thumbs-down':{const up=contact==='thumbs-up',pump=.025*Math.sin(p*Math.PI*4);this.place('R',C(-.19,.14+pump,.36),v3(.15,.1,1),v3(up?1:-1,0,0),[0,1.35,1.45,1.45,1.4],w,{thumb:v3(0,up?1:-1,.1)});if(!up)turn('Head',Z,-.05*k);break;}
      case 'wave':{const swing=Math.sin(p*Math.PI*7)*smooth(.15,.3,p);this.place('R',H(-.3,-.03,.16),v3(.5*swing,1,0),v3(-.15*swing,0,1),OPEN,w,{thumb:'open'});turn('Head',Z,-.04*k);break;}
      case 'blow-kiss':case 'chef-kiss':{
        const out=smooth(.42,.6,p),kiss=contact==='blow-kiss',lips=H(-.005,.02,.12),away=kiss?H(-.22,-.02,.48):H(-.24,.06,.32);
        this.place('R',lips.lerp(away,out),v3(.15,1,-.25).lerp(kiss?v3(-.2,.3,1):v3(-.35,.8,.45),out),kiss?v3(0,-.1,-1).lerp(v3(0,1,.1),out):v3(0,-.1,-1).applyAxisAngle(Y,-Math.PI*out),mix(kiss?[.5,.35,.3,.35,.4]:[.8,.6,.6,.6,.6],kiss?OPEN:[-.05,-.1,-.1,-.1,-.12],out),w,{tip:'Finger22',tipWeight:1-smooth(.25,.75,out)});
        turn('Head',X,-.05*k*out);break;}
      case 'namaste':both((side,m)=>this.place(side,C(m*.03,.08,.26),v3(m*.06,1,.3),v3(-m,0,0),[0,0,0,0,.03],w,{hint:v3(m,-.6,0),thumb:v3(0,.75,-.6)}));break;
      case 'salute':this.place('R',H(-.065,.125,.11),v3(.6,.55,.25),v3(-.25,-.55,.8),[0,0,0,0,0],w,{tip:'Finger12',hint:v3(-.8,-.6,.6),thumb:'along'});break;
      case 'ok-sign':this.place('R',H(-.3,-.16,.24),v3(0,1,.1),v3(0,0,1),[.95,1.15,.08,.18,.28],w);turn('Head',Z,-.05*k);break;
      case 'peace-sign':this.place('R',H(-.28,-.1,.24),v3(.1,1,0),v3(0,0,1),[.9,0,0,1.45,1.45],w);turn('Head',Z,-.08*k);break;
      case 'finger-guns':{const shot=Math.max(smooth(.42,.46,p)*(1-smooth(.46,.56,p)),smooth(.62,.66,p)*(1-smooth(.66,.76,p)));both((side,m)=>this.place(side,C(m*.2,.06+.05*shot,.42),v3(-m*.5,.15+.45*shot,.85),v3(-m,0,0),[0,0,1.4,1.45,1.35],w,{thumb:v3(0,1,.15)}));turn('Head',Z,.06*k);break;}
      case 'air-quotes':{const q=.1+1.1*(between(p,.35,.42,.05)+between(p,.52,.59,.05));both((side,m)=>this.place(side,H(m*.24,-.13,.24),v3(0,1,.05),v3(0,0,1),[1,q,q,1.45,1.45],w));turn('Head',Z,.05*k);break;}
      case 'shush':this.place('R',H(-.005,.015,.13),v3(.05,1,.1),v3(1,0,0),[.9,0,1.45,1.45,1.4],w,{tip:'Finger12'});turn('Head',X,.05*k);break;
      case 'mind-blown':{const burst=smooth(.4,.52,p);both((side,m)=>{const temple=H(m*.075,.13,.05),blown=H(m*.26,.12,.24);this.place(side,temple.lerp(blown,burst),v3(-m*.35,.8,.3).lerp(v3(m*.5,.85,.15),burst),v3(-m,0,0).lerp(v3(0,0,1),burst),mix([.5,.1,.5,.9,1],[-.05,-.1,-.12,-.12,-.1],burst),w,{tip:'Finger12',tipWeight:1-smooth(.25,.75,burst),hint:v3(m,0,-.3)});});turn('Head',X,-.12*k*burst);break;}
      case 'hand-on-heart':this.place('R',C(.15,.13,.13),v3(.9,.35,0),v3(0,0,-1),[.2,.04,.04,.06,.1],w,{tip:'Finger22'});turn('Head',Z,.08*k);break;
      case 'beckon':{const b=.15+1.25*Math.sin(p*Math.PI*8)**2;this.place('R',C(-.2,.06,.42),v3(.12,.15,1),v3(0,1,0),[.5,b,1.2+.1*b,1.3,1.3],w,{thumb:'open'});turn('Head',Z,-.05*k);break;}
      case 'rub-hands':{const rub=.03*Math.sin(p*Math.PI*12);both((side,m)=>this.place(side,C(m*.035,.0+m*rub,.3),v3(-m*.2,.45,.85),v3(-m,0,0),[.2,.05,.05,.08,.12],w,{hint:v3(m,-1,0)}));break;}
      case 'call-me':{const wiggle=.08*Math.sin(p*Math.PI*6);this.place('R',H(-.12,-.02,.1),v3(.4+wiggle,-1,.2),v3(.7,0,-.7),[0,1.5,1.55,1.55,0],w,{hint:v3(-.8,-1,0),thumb:v3(-.1,1,-.1)});turn('Head',Z,-.08*k);break;}
      case 'raise-roof':{const pump=beat(8)*smooth(.12,.25,p);both((side,m)=>this.place(side,H(m*.3,-.04+.2*pump,.12),v3(-m*.6,.2,.8),v3(m*.12,1,.5),OPEN,w,{hint:v3(m,-.4,0),thumb:'open'}));break;}
      case 'victory':both((side,m)=>this.place(side,H(m*.36,.42,.1),v3(m*.2,1,.1),v3(0,0,1),FIST,w,{hint:v3(m,0,0)}));turn('Head',X,-.08*k);break;
      case 'cheer':{const shake=Math.sin(p*Math.PI*10)*.06;both((side,m)=>this.place(side,H(m*(.32+shake),.38,.14),v3(m*(.15+shake*2),1,0),v3(0,0,1),OPEN,w,{hint:v3(m,0,0),thumb:'open'}));turn('Head',X,-.1*k);break;}
      case 'fist':{const pump=Math.max(0,Math.sin(p*Math.PI*5))**2*smooth(.15,.3,p);this.place('R',H(-.28,.12-.22*pump,.22),v3(.1,1,.2),v3(.6,0,-.8),FIST,w);turn('Head',X,.05*k*pump);break;}
      case 'disco':{const roll=p*Math.PI*14;both((side,m)=>this.place(side,C(m*.04+.06*Math.cos(roll+(m>0?Math.PI:0)),.02+.07*Math.sin(roll+(m>0?Math.PI:0)),.34),v3(-m*.5,0,.85),v3(0,-1,0),FIST,w));break;}
      case 'slow-clap':{const spread=.035+.13*Math.sin(p*Math.PI*4)**2,y=chest.y+.08;this.hand('R',v3(-spread,y,.36).add(this.seatShift),w);this.hand('L',v3(spread,y,.36).add(this.seatShift),w);this.uprightHand('R',w,false,true);this.uprightHand('L',w,false,true);break;}
      case 'mic-drop':{
        const lift=smooth(.08,.26,p),out=smooth(.26,.46,p),release=smooth(.56,.70,p),returning=smooth(.82,.98,p),fall=Math.max(0,p-.6)*(action.durationMs||4400)/1000,rest=this.micBody.position.clone(),offset=v3(.085,-.025,.025),hold=H(.38,-.04,.42),grip=rest.clone().add(offset).lerp(hold,out),dropped=grip.clone().sub(offset);
        const drop=Math.min(1,4.9*fall*fall/Math.max(.05,hold.y-.88));dropped.y=THREE.MathUtils.lerp(dropped.y,.875,drop);
        this.micBody.position.lerpVectors(rest,dropped,lift*w*(1-returning));this.micBody.rotation.z=drop>=1?Math.PI/2*smooth(0,.25,fall-.35)*w*(1-returning):0;
        this.place('L',rest.clone().add(offset).lerp(grip,lift).add(v3(0,.04*smooth(.6,.7,p),0)),v3(0,0,1).lerp(v3(0,-.3,1),release),v3(-1,0,0).lerp(v3(0,-1,0),release),mix([.6,.68,.68,.68,.68],OPEN,release),w*(1-smooth(.8,.98,p)));
        if(p>.62){turn('Head',Y,.18*k*smooth(.62,.75,p));turn('Head',Z,-.05*k);}break;}
      case 'object':this.place('R',H(-.22,-.02,.4),v3(0,1,.35),v3(0,0,1),POINT,w);turn('Spine2',X,.08*k);turn('Head',X,.06*k);break;
      case 'cheeks':both((side,m)=>this.place(side,H(m*.075,.12,.065),v3(-m*.15,1,.05),v3(-m,0,0),[.15,.05,.05,.08,.12],w,{tip:'Finger22',hint:v3(m*.4,-1,.2)}));break;
      case 'cover-mouth':this.place('R',H(.075,.03,.11),v3(1,.15,0),v3(0,0,-1),[.25,.15,.15,.18,.22],w,{tip:'Finger22'});break;
      case 'neck-rub':{const rub=.015*Math.sin(p*Math.PI*8);this.place('R',H(.03,-.01+rub,-.08),v3(.95,.25,0),v3(0,0,1),[.2,.15,.18,.2,.25],w,{tip:'Finger22',hint:v3(-1,.2,0)});break;}
      case 'hands-on-head':both((side,m)=>this.place(side,H(-m*.03,.2,.02),v3(-m,0,.2),v3(0,-1,0),[.3,.2,.25,.3,.35],w,{tip:'Finger22',hint:v3(m,.3,0)}));break;
      case 'straighten':{const tug=smooth(.08,.25,p)*(1-smooth(.5,.6,p)),smoothing=smooth(.5,.65,p)*(1-smooth(.85,.97,p)),pull=.04*Math.sin(p*Math.PI*6)**2;
        if(tug>.01)both((side,m)=>this.place(side,C(m*.11,-.13-pull,.2),v3(0,-1,.25),v3(0,0,-1),[.6,.9,.95,1,1],w*tug,{hint:v3(m,-.3,0)}));
        if(smoothing>.01)both((side,m)=>this.place(side,C(m*.1,.02+.08*smooth(.55,.85,p),.15),v3(-m*.25,1,.05),v3(0,0,-1),[.2,.1,.1,.12,.15],w*smoothing,{hint:v3(m,-.5,0)}));
        turn('Head',X,.14*k*tug+.06*k*smoothing);break;}
      case 'glasses':{const push=.008*Math.sin(p*Math.PI*3);this.place('R',H(0,.1+push,.115),v3(.08,1,-.3),v3(.15,0,-1),[.7,0,1.2,1.3,1.35],w,{tip:'Finger12',hint:v3(-1,-.5,0)});turn('Head',X,.04*k);break;}
      case 'stretch':{const up=smooth(.1,.38,p)*(1-smooth(.72,.92,p));if(up>.01)both((side,m)=>this.place(side,H(m*.05,.5,.05),v3(-m*.9,.3,0),v3(0,1,0),[.4,.5,.5,.5,.5],w*up,{hint:v3(m,0,0)}));break;}
      case 'chin-touch':this.place('R',H(-.045,.055,.085),v3(.15,1,.05),v3(.5,0,-.85),[.6,0,1.3,1.35,1.35],w,{tip:'Finger12'});break;
      case 'chin':this.place('R',H(-.01,-.07,.1),v3(.1,.75,.6),v3(.3,0,-1),FIST,w,{tip:'Finger1',hint:v3(-.2,-1,.4)});turn('Head',X,.07*k);break;
      case 'facepalm':this.place('R',H(.01,.13,.1),v3(.12,1,-.15),v3(0,0,-1),[.2,.06,.05,.08,.12],w,{tip:'Finger22'});break;
      case 'double-facepalm':both((side,m)=>this.place(side,H(m*.04,.13,.095),v3(-m*.15,1,-.15),v3(0,0,-1),[.2,.06,.05,.08,.12],w,{tip:'Finger22',hint:v3(m*.5,-1,0)}));break;
      case 'fold-arms':this.place('L',C(-.09,-.02,.16),v3(-1,0,-.4),v3(0,0,-1),[.4,.5,.55,.6,.65],w,{hint:v3(.5,-1,.1)});this.place('R',C(.09,.03,.2),v3(1,.05,-.45),v3(0,.3,-1),[.35,.45,.5,.55,.6],w,{hint:v3(-.5,-1,.1)});break;
      case 'point':{const dx=action.stage?.dx??-1.2,side:Side=dx>0?'L':'R',m=side==='L'?1:-1,shoulder=this.local(side+' UpperArm'),aimAt=v3(dx,head.y-.05,.1).add(this.seatShift),dir=aimAt.sub(shoulder).normalize(),jab=.04*Math.sin(p*Math.PI*4)**2;
        this.place(side,shoulder.clone().addScaledVector(dir,.5+jab),this.toBody(dir),v3(m*.3,-1,0),POINT,w,{hint:v3(m*.3,-1,-.2)});break;}
      case 'point-down':{const tap=.025*Math.sin(p*Math.PI*6)**2*smooth(.25,.4,p);this.place('R',this.notes.position.clone().add(v3(-.03,.045+tap,0)),v3(.15,-.7,.7),v3(0,-.7,-.7),POINT,w,{tip:'Finger12'});turn('Head',X,.12*k);break;}
      case 'tap-fingers':{const flat=v3(-.16,.91,.48).add(this.seatShift);this.hand('R',flat,w);this.flatHand('R',w);this.digits('R',[0,1,2,3,4].map(n=>n?-.35*Math.max(0,Math.sin(p*Math.PI*14-(4-n)*.9)):0),w);this.hand('L',v3(.16,.91,.48).add(this.seatShift),w);this.flatHand('L',w);break;}
      case 'rest-elbows':both((side,m)=>this.place(side,H(m*.04,-.18,.2),v3(-m*.8,.55,.1),v3(-m*.4,0,-.9),[.6,1,1.05,1.1,1.15],w,{hint:v3(m*.3,-1,.2)}));break;
      case 'lean-on-desk':both((side,m)=>{this.hand(side,v3(m*.1,.885,.5).add(this.seatShift),w,v3(m*.6,-.4,-.4));this.orient(side,v3(-m*.85,0,.5),v3(0,-1,0),w);this.digits(side,RELAXED,w);});break;
      default:return false;
    }
    return true;
  }

  // Hands, props and body language for the travelling and partnered actions.
  private stagePerformance(action:ActiveAction,route:NonNullable<ReturnType<StudioMotionRig['stage']>>,k:number,env:number,head:THREE.Vector3){
    const id=action.actionId,turn=this.rig.turn,meet=route.plan.meet,w=Math.min(1,env*1.3);
    if(meet){
      const reach=route.window('meet','part',700);
      if(id==='social.handshake'&&reach>.01){const shake=.035*Math.sin(route.sample.timeMs/1000*Math.PI*5)*route.window('meet','part',1100);this.place('R',v3(meet.x,head.y-.52+shake,meet.z+.02),v3(0,-.1,1),v3(1,0,0),[.35,.55,.65,.7,.75],w*reach,{hint:v3(-.4,-1,0)});turn('Head',X,.05*reach*k);}
      if(id==='social.high-five'){const raise=route.window('meet','part',900),slap=smooth(.35,.55,(route.sample.timeMs-route.plan.marks.meet)/1700);if(raise>.01)this.place('R',v3(meet.x,head.y+.1,meet.z).lerp(head.clone().add(this.rel(-.25,.02,.15)),1-slap),v3(0,1,.25),v3(0,0,1),OPEN,w*raise,{hint:v3(-1,0,0)});}
      if(id==='props.hand-over-note'){
        // The lead lifts their notes, both meet with a 10 cm gap and the
        // partner carries the page back to their own desk.
        const lead=action.stage?.role!=='partner',t=route.sample.timeMs,given=t>route.plan.marks.meet+1300,picked=route.plan.marks.picked,pick=lead?smooth(picked-900,picked-350,t)*(1-smooth(picked-250,picked,t)):0;
        if(pick>.01)this.place('R',this.notes.position.clone().add(v3(-.08,.03,0)),v3(0,-.3,1),v3(0,-1,0),RELAXED,pick*w);
        if(reach>.01)this.place('R',v3(meet.x-Math.sign(meet.x||1)*.05,head.y-.45,meet.z+.04),v3(0,0,1),v3(.4,1,0),[.4,.5,.55,.6,.65],w*reach,{hint:v3(-.4,-1,0)});
        const holding=lead?t>picked-250&&!given:given&&t<route.plan.marks.placed-500;
        if(holding){this.notes.position.copy(this.local('R Hand')).add(this.rel(.02,-.02,.09));this.notes.rotation.set(-1.1,0,0);}
        else if(lead&&given)this.notes.visible=false;
      }
    }
    switch(MOTION_BINDINGS[id]?.stage){
      case 'pace':{const pacing=route.window('pacing','paced',700);if(pacing>.01){(['R','L'] as const).forEach(side=>{const m=side==='L'?1:-1;this.place(side,this.local('Spine').add(this.rel(m*.06,-.1,-.2)),v3(-m*.8,-.4,0),v3(0,0,-1),RELAXED,pacing*w,{hint:v3(m,0,-1)});});turn('Head',X,.16*pacing*k);}break;}
      case 'storm-off':this.digits('R',FIST,w);this.digits('L',FIST,w);turn('Head',X,.08*k);break;
      case 'return':turn('Head',X,.22*k*route.sample.stand);turn('L Clavicle',Z,.07*k);turn('R Clavicle',Z,-.07*k);break;
      case 'walk-out':{const glance=route.window('glance','gone',500)*(1-smooth(0,1,(route.sample.timeMs-route.plan.marks.glance)/1400));turn('Head',Y,.3*glance*k);turn('Spine2',Y,.15*glance*k);break;}
      case 'approach':{const talk=route.window('talk','done',600);if(talk>.01){const beat=Math.sin(route.sample.timeMs/1000*Math.PI*1.6);this.place('R',head.clone().add(this.rel(-.2,-.38+.04*beat,.32)),v3(.1,.25,1),v3(.3,1,0),OPEN,talk*w);turn('Spine',X,.1*talk*k);turn('Head',X,.06*talk*k);}break;}
      case 'faint':{
        const swoon=route.window('swoon','fall',300),out=route.window('fall','recover',300);
        if(swoon>.01){this.place('R',head.clone().add(this.rel(.05,.16,.1)),v3(1,.15,0),v3(0,.2,1),[.2,.1,.1,.15,.2],swoon*w,{tip:'Finger22',hint:v3(-1,0,0)});turn('Head',X,-.16*swoon*k);turn('Spine',Z,.05*swoon*Math.sin(route.sample.timeMs/1000*Math.PI*1.4));}
        if(out>.01){turn('Spine1',X,-.12*out);turn('Spine2',X,-.1*out);turn('Head',X,-.32*out);turn('Head',Z,.22*out);this.hand('L',this.local('L UpperArm').add(this.rel(.14,-.5,-.02)),out*w,v3(1,0,-.5));this.hand('R',this.local('Pelvis').add(this.rel(-.12,.08,.22)),out*w);}
        break;}
      case 'stumble':{const trip=route.window('trip','caught',180),caught=route.window('caught','steady',300),flail=Math.sin(route.sample.timeMs/1000*Math.PI*6);
        if(trip>.01){turn('Spine',X,.32*trip);turn('Spine2',X,.15*trip);(['R','L'] as const).forEach(side=>{const m=side==='L'?1:-1;this.place(side,head.clone().add(this.rel(m*(.42+.06*flail*m),-.2+.12*flail*m,.25)),v3(m*.6,.4,.6),v3(0,0,1),OPEN,trip*w,{hint:v3(m,0,0)});});}
        if(caught>.01){turn('Head',Y,.25*caught*Math.sin(route.sample.timeMs/1000*Math.PI*1.5));this.place('R',head.clone().add(this.rel(.03,-.01,-.08)),v3(.95,.25,0),v3(0,0,1),RELAXED,caught*w,{tip:'Finger22',hint:v3(-1,.2,0)});}
        break;}
    }
  }

  snapshot(){return {cup:this.cup.position.toArray(),microphone:this.micBody.position.toArray(),microphoneStand:this.mic.position.toArray(),notes:this.notes.position.toArray(),laptop:this.laptop.visible,watch:this.watch.visible};}
  dispose(){this.rig.group.remove(this.props);this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
