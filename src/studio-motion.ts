import * as THREE from 'three';
import {MOTION_BINDINGS,motionWindow} from '../shared/studio/motion-library.mjs';
import type {ActiveAction} from '../shared/studio/performance.mjs';

type Clip={durationMs:number;frames:number;directions:number[];palms:number[];hips:number[];across:number[]};
type Bank={schemaVersion:number;bones:string[];clips:Record<string,Clip>};
let bank:Bank|null=null,pending:Promise<Bank>|null=null;
export function loadStudioMotions(){if(bank)return Promise.resolve(bank);return pending||=(async()=>{try{const response=await fetch('/motions/rocketbox/body.json');if(!response.ok)throw new Error('Motion library unavailable');const value:Bank=await response.json();if(value.schemaVersion!==1||!value.bones.length||!Object.keys(value.clips).length)throw new Error('Invalid motion library');bank=value;return value;}catch(error){pending=null;throw error;}})();}
export const studioMotionsReady=()=>!!bank;

type Rig={group:THREE.Group;bone:(name:string)=>THREE.Bone|undefined;aim:(bone:THREE.Bone,child:THREE.Object3D,direction:THREE.Vector3)=>void;twist:(bone:THREE.Bone,child:THREE.Object3D,index:THREE.Object3D,pinky:THREE.Object3D,direction:THREE.Vector3)=>void;turn:(name:string,axis:THREE.Vector3,angle:number)=>void};
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const children:Record<string,string>={Pelvis:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:'HeadNub','L Clavicle':'L UpperArm','R Clavicle':'R UpperArm','L UpperArm':'L Forearm','R UpperArm':'R Forearm','L Forearm':'L Hand','R Forearm':'R Hand','L Hand':'L Finger2','R Hand':'R Finger2','L Thigh':'L Calf','R Thigh':'R Calf','L Calf':'L Foot','R Calf':'R Foot','L Foot':'L Toe0','R Foot':'R Toe0'};
const smooth=(a:number,b:number,t:number)=>{const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
const envelope=(a:ActiveAction)=>a.envelope??Math.sin(Math.PI*a.progress)**.4;
const track=(values:number[],frame:number,stride:number,offset=0)=>{const i=Math.floor(frame),t=frame-i,count=values.length/stride,out=new THREE.Vector3();for(let axis=0;axis<3;axis++){const raw=(n:number)=>values[Math.max(0,Math.min(count-1,n))*stride+offset+axis],value=(n:number)=>(raw(n-2)+2*raw(n-1)+3*raw(n)+2*raw(n+1)+raw(n+2))/9,a=value(i-1),b=value(i),c=value(i+1),d=value(i+2);out.setComponent(axis,.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));}return out;};
const headOnly=(id:string)=>/^(response\.(nod|shake-head|concede-point|reluctantly-agree|dismiss-argument)|listening\.(attentive-nod|acknowledge-point)|presence\.glance-around)$/.test(id);
const quietArms=(id:string)=>headOnly(id)||/^(expression\.|response\.(raise-eyebrow|sceptical-look|look-to-host)|social\.knowing-glance|debate\.turn-away|listening\.|presence\.(breathe|blink|shift-weight|adjust-posture|glance-around)|comedy\.(smirk|chuckle|laugh|suppress-laughter|mock-shock|deadpan-stare|double-take)|fatigue\.(slump|drooping-eyelids|nod-off)|drama\.(freeze-disbelief|dramatic-pause|exaggerated-sigh|slow-turn-to-camera))/.test(id);
const windows=new WeakMap<Clip,Map<string,{startMs:number;speed:number}>>();

export class StudioMotionRig{
  readonly props=new THREE.Group();
  private cup=new THREE.Group();private notes=new THREE.Group();private mic=new THREE.Group();private micBody=new THREE.Group();private pen=new THREE.Group();private laptop=new THREE.Group();private lid=new THREE.Group();private watch=new THREE.Group();
  private contactStrength=1;private materials:THREE.Material[]=[];private geometries:THREE.BufferGeometry[]=[];
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

  posture(actions:ActiveAction[]){
    let stand=0,jump=0,rootY=0,yaw=0;
    for(const action of actions){const definition=MOTION_BINDINGS[action.actionId];if(definition?.mode==='standing')stand=Math.max(stand,smooth(0,.23,action.progress)*(1-smooth(.77,1,action.progress)));if(definition?.mode==='sit-transition')stand=Math.max(stand,smooth(0,.18,action.progress)*(1-smooth(.30,.85,action.progress)));if(definition?.pose==='jump'){const flight=(action.progress-.34)/.32;if(flight>0&&flight<1)jump=(action.actionId==='movement.hop'?.12:.28)*4*flight*(1-flight)*(action.motionScale??1);}
      if(action.actionId==='movement.turn')yaw=.65*smooth(0,.45,action.progress)*(1-smooth(.65,1,action.progress));
      if(definition?.mode==='standing'&&definition.clip&&bank){const clip=bank.clips[definition.clip];if(clip&&action.actionId!=='movement.stand'&&action.actionId!=='debate.push-chair-back'){const frame=this.phase(action,clip)*(clip.frames-1),i=Math.floor(frame),j=Math.min(clip.frames-1,i+1),height=THREE.MathUtils.lerp(clip.hips[i*3+1]||0,clip.hips[j*3+1]||0,frame-i);rootY=Math.max(-.38,Math.min(.18,height))*envelope(action);}}
    }
    return {stand,jump,rootY,yaw,back:-.25*stand};
  }

  private phase(action:ActiveAction,clip:Clip){const duration=action.durationMs||2800,elapsed=action.elapsedMs??action.progress*duration,key=duration+':'+headOnly(action.actionId);let cache=windows.get(clip);if(!cache){cache=new Map();windows.set(clip,cache);}let window=cache.get(key);if(!window){window=motionWindow(clip,bank!.bones,duration,headOnly(action.actionId));cache.set(key,window);}return Math.min(1,(window.startMs+elapsed*window.speed)/clip.durationMs);}
  hasNative(actionId:string){return !!bank&&!!MOTION_BINDINGS[actionId]?.clip;}
  private local(name:string){const b=this.rig.bone(name);return b?this.props.worldToLocal(b.getWorldPosition(new THREE.Vector3())):new THREE.Vector3(0,1.1,0);}
  private world(point:THREE.Vector3){return this.rig.group.localToWorld(point.clone());}
  private direction(vector:THREE.Vector3){return vector.applyQuaternion(this.rig.group.getWorldQuaternion(new THREE.Quaternion()));}

  private native(action:ActiveAction,seated:boolean,energy:number){
    const definition=MOTION_BINDINGS[action.actionId],clip=definition?.clip&&bank?.clips[definition.clip];if(!clip||!bank||action.intensity<.0001)return;
    const f=this.phase(action,clip)*(clip.frames-1),weight=Math.min(.72,action.intensity*(.8+energy*.25))*Math.min(1,(action.durationMs||2800)/1400),stride=bank.bones.length*3;
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

  // Analytic two-bone IK keeps the destination avatar's own bone lengths.
  private hand(side:'L'|'R',target:THREE.Vector3,weight=1){
    const upper=this.rig.bone(side+' UpperArm'),fore=this.rig.bone(side+' Forearm'),hand=this.rig.bone(side+' Hand');if(!upper||!fore||!hand||weight<=0)return;
    this.rig.group.updateMatrixWorld(true);const s=upper.getWorldPosition(new THREE.Vector3()),e=fore.getWorldPosition(new THREE.Vector3()),w=hand.getWorldPosition(new THREE.Vector3()),goal=w.clone().lerp(this.props.localToWorld(target.clone()),Math.min(1,weight)),l1=s.distanceTo(e),l2=e.distanceTo(w),d=THREE.MathUtils.clamp(s.distanceTo(goal),Math.abs(l1-l2)+.001,l1+l2-.003),axis=goal.clone().sub(s).normalize(),hint=this.direction(new THREE.Vector3(side==='L'?.3:-.3,-1,-.15));hint.addScaledVector(axis,-hint.dot(axis));if(hint.lengthSq()<.001)hint.copy(this.direction(new THREE.Vector3(side==='L'?1:-1,0,0)));hint.normalize();goal.copy(s).addScaledVector(axis,d);
    const a=(l1*l1-l2*l2+d*d)/(2*d),elbow=s.clone().addScaledVector(axis,a).addScaledVector(hint,Math.sqrt(Math.max(0,l1*l1-a*a))),orientation=hand.getWorldQuaternion(new THREE.Quaternion());
    this.rig.aim(upper,fore,elbow.clone().sub(s));this.rig.aim(fore,hand,goal.sub(elbow));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));hand.updateMatrixWorld(true);
  }

  settleHands(actions:ActiveAction[],seatStyle:number,seated:boolean,stand:number){
    if(!seated||stand>=1)return;
    for(const side of ['L','R'] as const){
      const lap=seatStyle===1&&side==='R'||seatStyle===2&&side==='L',x=(side==='L'?1:-1)*.18,goal=new THREE.Vector3(x,lap?.72:.92,lap?.15:seatStyle===3?.36:.38);
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
      for(const action of actions){if(quietArms(action.actionId))continue;const contact=MOTION_BINDINGS[action.actionId]?.contact;
        const onlyRight=['facepalm','glasses','chin','raise-hand','raise-finger','stop-hand','point','cup','fist'].includes(contact||''),onlyLeft=contact==='microphone'||contact==='check-time';
        if(onlyRight&&side==='L'||onlyLeft&&side==='R')continue;release=Math.max(release,envelope(action));}
      const weight=1-release;if(weight<=0)continue;
      this.hand(side,goal,weight);if(!lap)this.flatHand(side,weight);
    }
  }

  private fingers(side:'L'|'R',curl:number,except=-1){
    const hand=this.rig.bone(side+' Hand'),index=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4'),middle=this.rig.bone(side+' Finger2');if(!hand||!index||!pinky||!middle)return;
    const across=index.getWorldPosition(new THREE.Vector3()).sub(pinky.getWorldPosition(new THREE.Vector3())),forward=middle.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3())),palm=across.cross(forward).normalize().multiplyScalar(side==='L'?-1:1);
    for(let finger=0;finger<5;finger++){if(finger===except)continue;const first=this.rig.bone(`${side} Finger${finger}`),next=first?.children[0];if(!first||!next)continue;const hinge=next.getWorldPosition(new THREE.Vector3()).sub(first.getWorldPosition(new THREE.Vector3())).cross(palm).normalize();for(let segment=0;segment<3;segment++){const bone=this.rig.bone(`${side} Finger${finger}${segment||''}`),child=bone?.children[0];if(bone&&child){const direction=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize().applyAxisAngle(hinge,curl*this.contactStrength*(finger===0?.45:1));this.rig.aim(bone,child,direction);}}}
  }

  private gripHand(side:'L'|'R',weight:number,direction=-1){
    const hand=this.rig.bone(side+' Hand');if(!hand)return;this.flatHand(side);const yaw=new THREE.Quaternion().setFromAxisAngle(this.direction(Y.clone()),direction*Math.PI/2*weight),forward=this.direction(Z.clone()).applyQuaternion(yaw),roll=new THREE.Quaternion().setFromAxisAngle(forward,(side==='L'?-1:1)*Math.PI/2*weight),world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(yaw).premultiply(roll);hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  private flatHand(side:'L'|'R',weight=1){
    const hand=this.rig.bone(side+' Hand'),finger=this.rig.bone(side+' Finger2'),index=this.rig.bone(side+' Finger1'),pinky=this.rig.bone(side+' Finger4');if(hand&&finger){const before=hand.quaternion.clone(),orientation=this.props.getWorldQuaternion(new THREE.Quaternion());this.rig.aim(hand,finger,new THREE.Vector3(0,0,1).applyQuaternion(orientation));if(index&&pinky)this.rig.twist(hand,finger,index,pinky,new THREE.Vector3(side==='L'?-1:1,0,0).applyQuaternion(orientation));hand.quaternion.slerpQuaternions(before,hand.quaternion.clone(),weight);hand.updateMatrixWorld(true);}
  }

  private openHand(side:'L'|'R',weight:number){
    const hand=this.rig.bone(side+' Hand'),finger=this.rig.bone(side+' Finger2');if(!hand||!finger)return;const forward=this.direction(new THREE.Vector3(0,.2*weight,1).normalize());this.rig.aim(hand,finger,forward);const world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(forward,(side==='L'?1:-1)*Math.PI*weight));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  private uprightHand(side:'L'|'R',weight=1,palmIn=false,clap=false){
    const hand=this.rig.bone(side+' Hand');if(!hand)return;this.flatHand(side);const world=hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(this.direction(X.clone()),-Math.PI/2*weight));if(palmIn||clap)world.premultiply(new THREE.Quaternion().setFromAxisAngle(this.direction(Y.clone()),(side==='L'?-1:1)*(clap?Math.PI/2:Math.PI)*weight));hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));hand.updateMatrixWorld(true);
  }

  plantFeet(targets:Record<string,number[]>,weight=1){
    for(const side of ['L','R']){const thigh=this.rig.bone(side+' Thigh'),calf=this.rig.bone(side+' Calf'),foot=this.rig.bone(side+' Foot'),toe=this.rig.bone(side+' Toe0'),position=targets[side];if(!thigh||!calf||!foot||!position||weight<=0)continue;this.rig.group.updateMatrixWorld(true);const s=thigh.getWorldPosition(new THREE.Vector3()),e=calf.getWorldPosition(new THREE.Vector3()),w=foot.getWorldPosition(new THREE.Vector3()),l1=s.distanceTo(e),l2=e.distanceTo(w),goal=w.clone().lerp(this.world(new THREE.Vector3().fromArray(position)),weight),axis=goal.clone().sub(s).normalize(),d=THREE.MathUtils.clamp(s.distanceTo(goal),Math.abs(l1-l2)+.001,l1+l2-.003),hint=this.direction(new THREE.Vector3(0,0,1));hint.addScaledVector(axis,-hint.dot(axis)).normalize();goal.copy(s).addScaledVector(axis,d);const a=(l1*l1-l2*l2+d*d)/(2*d),knee=s.clone().addScaledVector(axis,a).addScaledVector(hint,Math.sqrt(Math.max(0,l1*l1-a*a)));this.rig.aim(thigh,calf,knee.clone().sub(s));this.rig.aim(calf,foot,goal.sub(knee));if(toe){const before=foot.quaternion.clone();this.rig.aim(foot,toe,this.direction(new THREE.Vector3(0,0,1)));foot.quaternion.slerpQuaternions(before,foot.quaternion.clone(),weight);foot.updateMatrixWorld(true);}}
  }

  apply(actions:ActiveAction[],energy:number,seated:boolean,seatStyle=0,stand=0){
    // Furniture props stay on the set when the host turns towards camera two.
    this.props.quaternion.copy(this.rig.group.quaternion).invert();this.props.updateWorldMatrix(true,true);
    this.props.visible=seated;this.cup.position.set(-.29,.855,.52);this.cup.rotation.set(0,0,0);this.notes.position.set(.02,.855,.52);this.notes.rotation.set(0,0,0);this.mic.position.set(.25,.855,.53);this.mic.rotation.set(0,0,0);this.micBody.position.copy(this.mic.position).y+=.16;this.micBody.rotation.set(0,0,0);this.pen.position.set(.15,.868,.48);this.pen.rotation.set(0,0,Math.PI/2-.65);this.laptop.visible=false;this.watch.visible=false;
    this.settleHands([],seatStyle,seated,stand);
    for(const action of actions){this.native(action,seated,energy);const definition=MOTION_BINDINGS[action.actionId];if(!definition)continue;const k=action.intensity*(.8+energy*.35),p=action.progress,env=envelope(action),head=this.local('Head'),turn=this.rig.turn;
      switch(definition.pose){
        case 'tilt':turn('Head',Z,.12*k);turn('Neck',X,.06*k);break;
        case 'glance':turn('Head',Y,(action.targetId?.08:.25)*k*Math.sin(p*Math.PI));break;
        case 'double-take':turn('Head',Y,k*(-.35*smooth(0,.22,p)+.65*smooth(.3,.56,p)));turn('Neck',Z,.045*k);break;
        case 'turn':if(action.actionId==='drama.slow-turn-to-camera')break;turn('Spine2',Y,.25*k);turn('Neck',Y,.15*k);turn('Head',Y,.3*k);break;
        case 'expression':if(action.actionId==='expression.eye-roll'){turn('LEye',X,-.22*k);turn('REye',X,-.22*k);}if(/concern|embarrassment|frown/.test(action.actionId))turn('Head',X,.06*k);if(action.actionId==='comedy.mock-shock')turn('Spine2',X,-.10*k);break;
        case 'bow':turn('Spine',X,.48*k);turn('Spine2',X,.3*k);turn('Head',X,.15*k);break;
        case 'jump':{const bend=(p<.34?smooth(.12,.28,p)*(1-smooth(.28,.34,p)):smooth(.62,.70,p)*(1-smooth(.70,.84,p)))*k;for(const side of ['L','R']){turn(side+' Thigh',X,-.38*bend);turn(side+' Calf',X,.64*bend);}if(action.actionId==='celebration.celebratory-jump'){turn('L UpperArm',Z,.65*k);turn('R UpperArm',Z,-.65*k);}break;}
        case 'slump':turn('Spine',X,.12*k);turn('Spine2',X,.17*k);turn('Head',X,.26*k);break;
        case 'sleep':turn('Spine',X,.48*env);turn('Spine1',X,.32*env);turn('Spine2',X,.35*env);turn('Neck',X,.35*env);turn('Head',X,.22*env);break;
        case 'wake':{const asleep=smooth(0,.15,p)*(1-smooth(.35,.65,p))*env,recoil=p>.35?Math.sin((p-.35)*Math.PI*3)*k:0;turn('Spine',X,.48*asleep);turn('Spine1',X,.32*asleep);turn('Spine2',X,.35*asleep-.18*recoil);turn('Neck',X,.35*asleep);turn('Head',X,.22*asleep-.16*recoil);turn('L Clavicle',Z,.08*k);turn('R Clavicle',Z,-.08*k);break;}
        case 'sigh':turn('Spine2',X,.13*k);turn('Head',X,.09*k);break;
        case 'recover':turn('Head',Z,.07*k*Math.sin(p*Math.PI*3));turn('Spine2',X,.07*k);break;
      }
      const contact=definition.contact;if(!contact||!seated||env<.001)continue;this.contactStrength=env;
      const right=new THREE.Vector3(-.16,.94,.48),left=new THREE.Vector3(.16,.94,.48);let grip=env;
      if(contact==='facepalm'||contact==='double-facepalm'||contact==='glasses'||contact==='chin'){
        const offset=contact==='chin'?new THREE.Vector3(-.04,-.15,.10):new THREE.Vector3(contact==='glasses'?-.10:-.07,-.08,.14);this.hand('R',head.clone().add(offset),grip);this.uprightHand('R',grip,true);if(contact==='double-facepalm'){this.hand('L',head.clone().add(new THREE.Vector3(.07,-.08,.14)),grip);this.uprightHand('L',grip,true);this.fingers('L',.06);}this.fingers('R',contact==='chin'?.7:contact==='glasses'?.35:.06,contact==='glasses'?1:-1);
      }else if(contact==='raise-hand'||contact==='raise-finger'||contact==='stop-hand'||contact==='count'){
        this.hand('R',head.clone().add(new THREE.Vector3(-.28,contact==='raise-hand'?.32:-.08,.28)),grip);this.uprightHand('R',grip);if(contact==='raise-finger')this.fingers('R',.55,1);if(contact==='count'){this.fingers('R',.5,1+Math.min(3,Math.floor(p*4)));this.hand('L',head.clone().add(new THREE.Vector3(.13,-.22,.30)),grip);this.flatHand('L');this.openHand('L',grip*.8);}
      }else if(contact==='fist'){this.hand('R',head.clone().add(new THREE.Vector3(-.28,.10+.08*Math.sin(p*Math.PI*2)**2,.22)),grip);this.gripHand('R',grip);this.fingers('R',1.15);}
      else if(contact==='point'){this.hand('R',new THREE.Vector3(-.23,.99,.60),grip);this.flatHand('R',grip);this.fingers('R',.65,1);}
      else if(contact==='fold-arms'){this.hand('R',new THREE.Vector3(.25,.99,.07),grip);this.hand('L',new THREE.Vector3(-.23,.94,.12),grip);this.uprightHand('R',grip,true);this.uprightHand('L',grip,true);this.fingers('R',.45);this.fingers('L',.45);}
      else if(contact==='clap'||contact==='clap-overhead'){const spread=.035+.12*Math.sin(p*Math.PI*7)**2,y=contact==='clap-overhead'?head.y+.22:1.04;this.hand('R',new THREE.Vector3(-spread,y,.36),grip);this.hand('L',new THREE.Vector3(spread,y,.36),grip);this.uprightHand('R',grip,false,true);this.uprightHand('L',grip,false,true);}
      else if(contact==='sleep'){this.hand('R',new THREE.Vector3(-.12,.91,.56),grip);this.hand('L',new THREE.Vector3(.12,.91,.56),grip);}
      else if(contact==='rest-elbows'||contact==='tap-table'||contact==='tap-fingers'){right.y=left.y=contact==='tap-table'?.91+.09*Math.sin(p*Math.PI*3)**2:.91;this.hand('R',right,grip);this.hand('L',left,grip);if(contact==='tap-fingers')this.fingers('R',.1*Math.sin(p*Math.PI*12));}
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
      if(['sleep','rest-elbows','tap-table','tap-fingers','write','laptop'].includes(contact)){this.flatHand('R',grip);this.flatHand('L',grip);}
    }
    // Keep hands that reach over the actual tabletop above its solid surface.
    if(seated)for(const side of ['L','R'] as const){const h=this.local(side+' Hand'),weight=smooth(.30,.43,h.z)*(1-smooth(1.35,1.50,h.z))*(1-smooth(.60,.75,Math.abs(h.x)));if(weight>0&&h.y<.90)this.hand(side,new THREE.Vector3(h.x,.90,h.z),weight);}
  }

  snapshot(){return {cup:this.cup.position.toArray(),microphone:this.micBody.position.toArray(),microphoneStand:this.mic.position.toArray(),notes:this.notes.position.toArray(),laptop:this.laptop.visible,watch:this.watch.visible};}
  dispose(){this.rig.group.remove(this.props);this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
