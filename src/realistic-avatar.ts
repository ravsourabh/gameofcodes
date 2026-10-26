import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { Character } from '../shared/session-domain.mjs';
import {AVATAR_MODELS,modelForAppearance,OUTFIT_TINTS} from '../shared/avatar-catalog.mjs';

// What the scene needs from any avatar, stylised or realistic.
export interface SceneAvatar {
  readonly character: Character;
  readonly group: THREE.Group;
  readonly hitbox: THREE.Mesh;
  readonly featureTargets: THREE.Mesh[];
  select(): void;
  setFeature(feature?: string): void;
  animate(time: number, camera: THREE.Vector3, mouth?: Mouth): void;
  dispose(): void;
}
// Mouth shape for the current speaker, each 0..1: how open, how rounded (O/U) and how wide (E/I), plus sibilance.
export type Mouth = { open: number; round: number; wide: number; hiss: number };

// Rocketbox avatars (MIT, Microsoft) converted to GLB by the asset script. The guide keeps a fixed identity.
export const realisticModelFor = (character:Character) => modelForAppearance(character.avatar);

const loader = new GLTFLoader();
const models = new Map<string, Promise<THREE.Object3D>>();
function loadModel(name: string) {
  if(!AVATAR_MODELS.some(m=>m.id===name))return Promise.reject(new Error('Unknown human avatar.'));
  if (!models.has(name)) models.set(name, loader.loadAsync(`/avatars/rocketbox/${name}.glb`).then(gltf => {
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = false; // Bounds come from the T-pose; posed arms can leave them.
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        // Hair, lashes and stubble cards: cut out instead of sorting translucent layers.
        if (material.name.endsWith('_opacity')) Object.assign(material, { transparent: false, alphaTest: .45, depthWrite: true, side: THREE.DoubleSide });
        if(material.name.includes('glasses'))Object.assign(material,{transparent:true,opacity:.18,alphaTest:0,depthWrite:false,roughness:.12,metalness:.15,color:new THREE.Color('#a8bdc7')});
      }
    });
    return gltf.scene;
  }).catch(error=>{models.delete(name);throw error;}));
  return models.get(name)!;
}

// Bones moved procedurally. Rotations are expressed in character space (x right, y up, z towards the viewer).
const RIG = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LEye', 'REye', 'L Clavicle', 'R Clavicle', 'L UpperArm', 'R UpperArm','L Forearm','R Forearm','L Hand','R Hand','L Thigh','R Thigh','L Calf','R Calf','L Foot','R Foot'] as const;
type RigName = typeof RIG[number];
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), v2 = new THREE.Vector3();
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

export class RealisticAvatar implements SceneAvatar {
  readonly group = new THREE.Group();
  readonly hitbox: THREE.Mesh;
  readonly featureTargets: THREE.Mesh[] = [];
  private holder = new THREE.Group();
  private ring: THREE.Mesh;
  private label: THREE.Sprite;
  private labelTexture: THREE.CanvasTexture;
  private rig = new Map<RigName, { bone: THREE.Bone; base: THREE.Quaternion; parent: THREE.Quaternion; parentInverse: THREE.Quaternion }>();
  // glTF splits a mesh per material (body, head, hair), and each part carries the same face shapes.
  private faces: { mesh: THREE.Mesh; morphs: Record<string, number> }[] = [];
  private disposed = false;
  private selectedAt = -1e9;
  private last = 0;
  private phase: number;
  private nextBlink = 1.5;
  private look = { yaw: 0, pitch: 0 };
  private mouth: Mouth = { open: 0, round: 0, wide: 0, hiss: 0 };
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private presence='Ready';private emphasis=false;
  private seated=false;private seatDrop=0;private seatedRig=new Map<RigName,{base:THREE.Quaternion;parent:THREE.Quaternion;parentInverse:THREE.Quaternion}>();
  private gesture=0;private turnKind='opening';private room='conference';
  state:'loading'|'ready'|'error'='loading';
  private ownedMaterials:THREE.Material[]=[];
  private accessoryMeshes:THREE.Mesh[]=[];
  private feature?:string;

  constructor(readonly character: Character, readonly model: string, private environment: THREE.Texture | null, private changed:()=>void=()=>{}) {
    this.phase = (character.avatar.seed % 1000) / 1000 * Math.PI * 2;
    const invisible = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(.72, 1.9, .65), invisible()); this.hitbox.position.y = .95;
    this.hitbox.userData.characterId = character.id; this.group.add(this.hitbox);
    for(const [feature,y,radius] of [['face',1.64,.16],['colour',1.15,.2],['accessory',1.45,.09]] as const){
      const target = new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),invisible());target.position.set(0,y,.08);target.userData={characterId:character.id,feature};this.featureTargets.push(target);this.group.add(target);
    }
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(.43, .015, 5, 36), new THREE.MeshBasicMaterial({ color: 0xe4c993, transparent: true, opacity: .9 }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .015; this.ring.visible = false; this.group.add(this.ring);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 100;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#132b28e8'; ctx.roundRect(8, 8, 496, 84, 20); ctx.fill(); ctx.fillStyle = '#f3e8ca'; ctx.font = '30px Georgia'; ctx.textAlign = 'center'; ctx.fillText(character.name.slice(0, 25), 256, 61);
    this.labelTexture = new THREE.CanvasTexture(canvas); this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture, depthTest: true, depthWrite: false }));
    this.label.position.set(0, 1.98, 0); this.label.scale.set(.88, .172, 1); this.group.add(this.label);
    this.group.add(this.holder);
    this.load();
  }

  private load(){
    this.state='loading';this.updateLabel();this.changed();
    loadModel(this.model).then(source=>{if(this.disposed)return;this.attach(cloneSkinned(source));this.state='ready';this.updateLabel();this.changed();}).catch(()=>{if(this.disposed)return;this.state='error';this.updateLabel();this.changed();});
  }
  private updateLabel(){const canvas=this.labelTexture.image as HTMLCanvasElement,ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,100);ctx.fillStyle=this.emphasis?'#3e3625ed':'#132b28da';ctx.roundRect(8,8,496,84,20);ctx.fill();ctx.fillStyle=this.emphasis?'#ffe2a2':'#f3e8ca';ctx.font='27px Georgia';ctx.textAlign='center';ctx.fillText((this.state==='error'?'Avatar unavailable · Retry':this.state==='loading'?'Loading '+this.character.name:this.character.name+(this.presence==='Speaking'?' · Speaking':this.presence==='Thinking'?' · Thinking':'')).slice(0,35),256,61);this.labelTexture.needsUpdate=true;this.label.material.opacity=this.emphasis||this.state!=='ready'?1:.75;}
  retry(){if(this.state==='error')this.load();}

  get loaded() { return this.faces.length > 0; }

  private attach(model: THREE.Object3D) {
    this.holder.add(model);
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const materials=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{
        const own=material.clone();this.ownedMaterials.push(own);
        if(own instanceof THREE.MeshStandardMaterial){own.envMap=this.environment;own.envMapIntensity=own.name.endsWith('_head')?.45:.3;
          if(own.name.endsWith('_body')&&object instanceof THREE.SkinnedMesh){
            if(!object.geometry.getAttribute('clothMask')){
              const index=object.geometry.getAttribute('skinIndex'),weight=object.geometry.getAttribute('skinWeight'),values=new Float32Array(index.count);
              for(let i=0;i<index.count;i++){let cloth=0;for(let j=0;j<4;j++){const bone=object.skeleton.bones[index.getComponent(i,j)];if(bone&&/Spine|Clavicle/i.test(bone.name))cloth+=weight.getComponent(i,j);}values[i]=Math.min(1,cloth);}
              object.geometry.setAttribute('clothMask',new THREE.BufferAttribute(values,1));
            }
            const tint=new THREE.Color(OUTFIT_TINTS[this.character.avatar.attributes.colour]||'#ffffff');
            own.onBeforeCompile=shader=>{shader.uniforms.outfitTint={value:tint};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float clothMask; varying float vClothMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nvClothMask = clothMask;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 outfitTint; varying float vClothMask;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), outfitTint, vClothMask);');};
            own.customProgramCacheKey=()=> 'human-outfit-tint-v1';
          }
        }return own;
      });object.material=Array.isArray(object.material)?materials:materials[0];
    });
    const bone = (name: string) => model.getObjectByName(`Bip01_${name.replace(/ /g, '_')}`) as THREE.Bone | undefined ?? model.getObjectByName(`Bip01 ${name}`) as THREE.Bone | undefined;
    const head = bone('Head'), leftEye = bone('LEye'), rightEye = bone('REye');
    // Face the viewer: turn the model so the eyes lie in front of the head.
    this.group.updateMatrixWorld(true);
    if (head && leftEye && rightEye) {
      const forward = leftEye.getWorldPosition(v).add(rightEye.getWorldPosition(v2)).multiplyScalar(.5).sub(head.getWorldPosition(new THREE.Vector3()));
      forward.applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()).invert());
      this.holder.rotation.y = -Math.atan2(forward.x, forward.z);
      this.group.updateMatrixWorld(true);
    }
    this.addAccessory(head,leftEye,rightEye);
    // Relax the T-pose: arms hang slightly out and forward, palms turn towards the thighs and fingers curl a little.
    for (const side of ['L', 'R'] as const) {
      const upper = bone(`${side} UpperArm`), fore = bone(`${side} Forearm`), hand = bone(`${side} Hand`);
      if (!upper || !fore || !hand) continue;
      const outward = Math.sign(upper.getWorldPosition(v).x - this.group.getWorldPosition(v2).x) || 1;
      const index = bone(`${side} Finger1`), pinky = bone(`${side} Finger4`);
      this.aim(upper, fore, new THREE.Vector3(outward * .12, -1, .04));
      if (index && pinky) this.twist(upper, fore, index, pinky);
      this.aim(fore, hand, new THREE.Vector3(outward * .08, -1, .28));
      if (index && pinky) this.twist(fore, hand, index, pinky);
      const palm = new THREE.Vector3(-outward, 0, .15).normalize();
      for (const [finger, curl] of [['0', .12], ['1', .22], ['2', .28], ['3', .32], ['4', .36]] as const) {
        const first = bone(`${side} Finger${finger}`), second = bone(`${side} Finger${finger}1`), third = bone(`${side} Finger${finger}2`);
        if (first && second) this.curl(first, second, palm, curl);
        if (second && third) this.curl(second, third, palm, curl * 1.3);
      }
    }
    model.traverse(object => { if (object instanceof THREE.Mesh && object.morphTargetDictionary && object.morphTargetInfluences) this.faces.push({ mesh: object, morphs: object.morphTargetDictionary }); });
    this.group.updateMatrixWorld(true);
    for (const name of RIG) {
      const item = bone(name); if (!item?.parent) continue;
      const parent = item.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.group.getWorldQuaternion(q).invert());
      this.rig.set(name, { bone: item, base: item.quaternion.clone(), parent, parentInverse: parent.clone().invert() });
    }
    const hips=[bone('L Thigh'),bone('R Thigh')].filter(Boolean) as THREE.Bone[];
    this.seatDrop=hips.length ? .53-hips.reduce((sum,b)=>sum+this.group.worldToLocal(b.getWorldPosition(new THREE.Vector3())).y,0)/hips.length : -.42;
    this.holder.position.y=this.seatDrop;this.group.updateMatrixWorld(true);
    const direction=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    for(const side of ['L','R']){
      const thigh=bone(side+' Thigh'),calf=bone(side+' Calf'),foot=bone(side+' Foot'),toe=bone(side+' Toe0');
      if(thigh&&calf)this.aim(thigh,calf,direction(side==='L'?-.035:.035,-.045,1));
      if(calf&&foot)this.aim(calf,foot,direction(0,-1,.055));if(foot&&toe)this.aim(foot,toe,direction(0,0,1));
      const upper=bone(side+' UpperArm'),fore=bone(side+' Forearm'),hand=bone(side+' Hand');
      if(upper&&fore)this.aim(upper,fore,direction(side==='L'?-.12:.12,-.55,.82));
      if(fore&&hand)this.aim(fore,hand,direction(side==='L'?-.12:.12,-.12,1));
    }
    this.group.updateMatrixWorld(true);
    for(const [name,item] of this.rig){const parent=item.bone.parent!.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.group.getWorldQuaternion(q).invert());this.seatedRig.set(name,{base:item.bone.quaternion.clone(),parent,parentInverse:parent.clone().invert()});}
    for(const item of this.rig.values())item.bone.quaternion.copy(item.base);
    this.holder.position.y=0;this.setSeated(this.seated);
    document.body.dataset.realisticAvatars = String(Number(document.body.dataset.realisticAvatars || 0) + 1);
  }

  private addAccessory(head?:THREE.Bone,leftEye?:THREE.Bone,rightEye?:THREE.Bone){
    if(this.character.avatar.attributes.accessory==='glasses'&&head&&leftEye&&rightEye){
      const centre=leftEye.getWorldPosition(new THREE.Vector3()).add(rightEye.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);centre.z+=.025;
      const glasses=new THREE.Group();head.add(glasses);glasses.position.copy(head.worldToLocal(centre));glasses.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.group.getWorldQuaternion(new THREE.Quaternion())));
      const metal=new THREE.MeshStandardMaterial({color:'#b9a16b',metalness:.8,roughness:.3});this.ownedMaterials.push(metal);
      for(const x of [-.032,.032]){const frame=new THREE.Mesh(new THREE.TorusGeometry(.025,.0018,5,28),metal);frame.position.x=x;glasses.add(frame);this.accessoryMeshes.push(frame);}
      const bridge=new THREE.Mesh(new THREE.CylinderGeometry(.0016,.0016,.016,6),metal);bridge.rotation.z=Math.PI/2;glasses.add(bridge);this.accessoryMeshes.push(bridge);
    }
    if(this.character.avatar.attributes.accessory==='brooch'){
      const material=new THREE.MeshStandardMaterial({color:'#bba372',metalness:.75,roughness:.35}),badge=new THREE.Mesh(new THREE.TorusGeometry(.026,.005,6,24),material);badge.position.set(.14,1.35,.13);this.group.add(badge);this.accessoryMeshes.push(badge);this.ownedMaterials.push(material);
    }
  }

  private aim(bone: THREE.Bone, child: THREE.Object3D, direction: THREE.Vector3) {
    const from = child.getWorldPosition(v).sub(bone.getWorldPosition(v2)).normalize();
    const turn = q.setFromUnitVectors(from, direction.normalize());
    const world = bone.getWorldQuaternion(q2).premultiply(turn);
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  // Roll a limb about its own length until the knuckle line (index to little finger) points forward: thumbs forward, palms inward.
  private twist(bone: THREE.Bone, child: THREE.Object3D, index: THREE.Object3D, pinky: THREE.Object3D) {
    const axis = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(v)).normalize();
    const across = index.getWorldPosition(new THREE.Vector3()).sub(pinky.getWorldPosition(v));
    across.addScaledVector(axis, -across.dot(axis)).normalize();
    const forward = new THREE.Vector3(0, 0, 1).addScaledVector(axis, -axis.z).normalize();
    const angle = Math.atan2(axis.dot(v.crossVectors(across, forward)), across.dot(forward));
    const world = bone.getWorldQuaternion(q2).premultiply(q.setFromAxisAngle(axis, angle));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  // Bend a finger segment towards the palm by an angle.
  private curl(bone: THREE.Bone, child: THREE.Object3D, palm: THREE.Vector3, angle: number) {
    const direction = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(v)).normalize();
    this.aim(bone, child, direction.multiplyScalar(Math.cos(angle)).addScaledVector(palm, Math.sin(angle)));
  }

  // Rotate a bone about a character-space axis, on top of its rest pose.
  private turn(name: RigName, axis: THREE.Vector3, angle: number) {
    const item = this.rig.get(name); if (!item || !angle) return;
    const pose=this.seated?this.seatedRig.get(name)||item:item;
    item.bone.quaternion.premultiply(q.copy(pose.parentInverse).multiply(q2.setFromAxisAngle(axis, angle)).multiply(pose.parent));
  }

  private weight(name: string, value: number) {
    for (const { mesh, morphs } of this.faces) { const index = morphs[name]; if (index !== undefined) mesh.morphTargetInfluences![index] = THREE.MathUtils.clamp(value, 0, 1); }
  }

  select() { this.selectedAt = performance.now(); }
  setFeature(feature?:string) { this.feature=feature; }
  setPresence(presence:string,emphasis:boolean){if(this.presence===presence&&this.emphasis===emphasis)return;this.presence=presence;this.emphasis=emphasis;this.updateLabel();}
  setSeated(value:boolean){this.seated=value;this.holder.position.y=value?this.seatDrop:0;const drop=value?this.seatDrop:0;this.label.position.y=1.98+drop;this.hitbox.position.y=.95+drop;for(const target of this.featureTargets){const y=target.userData.feature==='face'?1.64:target.userData.feature==='colour'?1.15:1.45;target.position.y=y+drop;}for(const m of this.accessoryMeshes)if(m.parent===this.group)m.position.y=1.35+drop;}
  setTurnKind(kind:string){this.turnKind=kind;}
  setRoom(room:string){this.room=room;}
  poseSnapshot(){this.group.updateMatrixWorld(true);const positions:Record<string,number[]>={};for(const name of ['Head','L Hand','R Hand','L Thigh','L Calf','L Foot'] as RigName[]){const bone=this.rig.get(name)?.bone;if(bone)positions[name]=bone.getWorldPosition(new THREE.Vector3()).toArray();}return {seated:this.seated,presence:this.presence,joints:positions};}

  animate(time: number, camera: THREE.Vector3, mouth?: Mouth) {
    const dt = Math.min(.1, Math.max(0, (time - this.last) / 1000)); this.last = time;
    this.ring.visible = this.emphasis||!!this.feature || performance.now() - this.selectedAt < 2200 || this.state!=='ready';
    (this.ring.material as THREE.MeshBasicMaterial).color.set(this.presence==='Unavailable'||this.state==='error'?'#cc8c6c':'#e4c993');
    if (!this.loaded) return;
    const t = time / 1000 + this.phase, still = this.reducedMotion ? 0 : 1;
    for (const [name,item] of this.rig) item.bone.quaternion.copy(this.seated?this.seatedRig.get(name)?.base||item.base:item.base);

    // Speech envelope, smoothed so the jaw neither snaps nor lags behind syllables.
    const target = mouth ?? { open: 0, round: 0, wide: 0, hiss: 0 };
    for (const key of ['open', 'round', 'wide', 'hiss'] as const) this.mouth[key] = damp(this.mouth[key], target[key], target.open > this.mouth.open ? 28 : 16, dt);
    const m = this.mouth, talking = m.open > .04;

    // Breathing, a slow weight shift and shoulders that rise a touch on each breath.
    const breath = Math.sin(t * 1.35) * still, sway = Math.sin(t * .31) * still;
    this.turn('Spine', Z, .012 * sway); this.turn('Spine', Y, .025 * Math.sin(t * .23) * still);
    this.turn('Spine1', X, -.012 * breath); this.turn('Spine2', X, -.01 * breath);
    this.turn('L Clavicle', Z, .012 * breath); this.turn('R Clavicle', Z, -.012 * breath);
    this.turn('L UpperArm', Z, -.02 * sway); this.turn('R UpperArm', Z, -.02 * sway);
    this.gesture=damp(this.gesture,this.presence==='Speaking'?1:0,5,dt);
    const beat=(.5+.5*Math.sin(t*2.1))*this.gesture*still*(this.room==='heated'?1.4:1),opposition=this.turnKind==='objection'?1.25:1;
    this.turn('R UpperArm',X,-.18*beat);this.turn('R Forearm',X,-.42*beat*opposition);this.turn('R Forearm',Y,.18*Math.sin(t*1.1)*this.gesture*still);this.turn('R Hand',Z,.18*Math.sin(t*2.1)*this.gesture*still);
    this.turn('L UpperArm',X,-.1*beat);this.turn('L Forearm',X,-.24*(.5+.5*Math.sin(t*1.7+1))*this.gesture*still);this.turn('L Hand',Y,-.15*beat);this.turn('Spine2',Y,.025*Math.sin(t*1.8)*this.gesture*still);
    if(this.presence==='Listening'){this.turn('Head',X,.025*Math.sin(t*.8)*still);this.turn('L Hand',X,.025*Math.sin(t*.7)*still);}
    if(this.presence==='Thinking'){this.turn('Head',Z,.035*still);this.turn('Neck',X,.035*still);}

    // Attention: the head turns towards the viewer within a comfortable range, eyes lead it.
    const head = this.rig.get('Head')?.bone;
    if (head) {
      head.getWorldPosition(v); this.group.getWorldPosition(v2);
      const dx = camera.x - v.x, dz = camera.z - v.z, dy = camera.y - v.y;
      const yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) - this.group.rotation.y, -.65, .65), pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -.3, .25);
      this.look.yaw = damp(this.look.yaw, yaw, 3, dt); this.look.pitch = damp(this.look.pitch, pitch, 3, dt);
      const nod = Math.max(0, 1 - (performance.now() - this.selectedAt) / 900) * Math.sin((performance.now() - this.selectedAt) / 140) * .12;
      const speechNod = talking ? m.open * .035 * Math.sin(t * 5.3) : 0, drift = .025 * Math.sin(t * .7) * still;
      this.turn('Neck', Y, this.look.yaw * .4 + drift); this.turn('Neck', X, -this.look.pitch * .35);
      this.turn('Head', Y, this.look.yaw * .5); this.turn('Head', X, -(this.look.pitch * .45 + nod + speechNod));
      const saccade = Math.sin(t * .9) * Math.sin(t * 2.3) * .04 * still;
      for (const eye of ['LEye', 'REye'] as const) { this.turn(eye, Y, this.look.yaw * .25 + saccade); this.turn(eye, X, -this.look.pitch * .2); }
    }

    // Blinks every few seconds, quicker to close than to open.
    if (t > this.nextBlink + .25) this.nextBlink = t + 2.2 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3.8;
    const since = t - this.nextBlink, blink = since < 0 ? 0 : since < .07 ? since / .07 : since < .22 ? 1 - (since - .07) / .15 : 0;
    this.weight('AK_09_EyeBlinkLeft', blink); this.weight('AK_10_EyeBlinkRight', blink);

    // Visemes from the speech envelope; a light resting smile keeps the face from looking blank.
    this.weight('AA_VI_10_aa', m.open * (1 - m.round * .6) * .85);
    this.weight('AA_VI_13_O', m.open * m.round * .8); this.weight('AA_VI_14_U', m.open * m.round * .35);
    this.weight('AA_VI_11_E', m.open * m.wide * .7); this.weight('AA_VI_12_I', m.open * m.wide * .35);
    this.weight('AA_VI_07_SS', m.hiss * .5);
    this.weight('AK_25_JawOpen', m.open * .18);
    this.weight('AK_03_BrowInnerUp', talking ? m.open * .25 : 0);
    const smile = this.room==='comedy'?.24+(talking?.08:0):talking ? .06 : .14; this.weight('AK_44_MouthSmileLeft', smile); this.weight('AK_45_MouthSmileRight', smile);
  }

  dispose() {
    this.disposed = true;
    // Model geometry, materials and textures are shared through the loader cache.
    for (const mesh of [this.hitbox, this.ring, ...this.featureTargets]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    this.label.material.dispose(); this.labelTexture.dispose();
    this.ownedMaterials.forEach(m=>m.dispose());this.accessoryMeshes.forEach(m=>m.geometry.dispose());
    if (this.loaded) document.body.dataset.realisticAvatars = String(Math.max(0, Number(document.body.dataset.realisticAvatars || 1) - 1));
  }
}
