import * as THREE from 'three';
export class BroadcastCamera {
  enabled=true;private lastTurn='';private sequence=0;private targetPosition=new THREE.Vector3(0,1.3,2.5);private targetRotation=new THREE.Quaternion();private fov=55;shot='wide';
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private camera:THREE.PerspectiveCamera){try{this.enabled=localStorage.getItem('goc-tv-camera')!=='off'&&!this.reduced;}catch{}this.targetRotation.copy(camera.quaternion);}
  toggle(){this.enabled=!this.enabled;try{localStorage.setItem('goc-tv-camera',this.enabled?'on':'off');}catch{}this.reset();}
  manual(){if(this.enabled)this.toggle();}
  reset(){this.lastTurn='';this.sequence=0;this.shot='wide';this.camera.position.set(0,1.3,2.5);this.camera.quaternion.identity();this.camera.fov=55;this.camera.updateProjectionMatrix();this.targetPosition.copy(this.camera.position);this.targetRotation.copy(this.camera.quaternion);}
  update(dt:number,xr:boolean,allowed:boolean,turnId:string,speaker?:THREE.Vector3,other?:THREE.Vector3){
    if(xr){this.shot='headset';return;}if(!allowed||!this.enabled)return;
    if(turnId&&turnId!==this.lastTurn&&speaker){
      this.lastTurn=turnId;this.sequence++;const pair=other&&speaker.distanceTo(other)>.3&&this.sequence%3===2;
      const target=pair?speaker.clone().add(other!).multiplyScalar(.5):speaker.clone();target.y=1.05;
      this.shot=this.sequence%4===0?'wide':pair?'two-person':'speaker';
      this.targetPosition.set(this.shot==='wide'?0:target.x*.7,this.shot==='wide'?1.48:1.42,this.shot==='wide'?2.1:target.z+(pair?4.4:3.0));
      if(this.shot==='wide')target.set(0,1.05,-3.5);
      const dummy=new THREE.PerspectiveCamera();dummy.position.copy(this.targetPosition);dummy.lookAt(target);this.targetRotation.copy(dummy.quaternion);this.fov=this.shot==='speaker'?42:pair?51:55;
    }
    const alpha=this.reduced?1:1-Math.exp(-Math.min(dt,.1)*5);this.camera.position.lerp(this.targetPosition,alpha);this.camera.quaternion.slerp(this.targetRotation,alpha);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,this.fov,alpha);this.camera.updateProjectionMatrix();
  }
}
