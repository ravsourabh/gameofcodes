import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RealisticAvatar} from '../../src/realistic-avatar';
import {generateCharacter} from '../../shared/character-domain.mjs';
import {lipSample} from '../../shared/studio/lips.mjs';
import type {LipTrack} from '../../shared/studio/index.mjs';
import {performanceSample} from '../../shared/studio/performance.mjs';
import {motionDuration,MOTION_ACTIONS} from '../../shared/studio/motion-library.mjs';
import type {MetaHumanCatalogue} from '../../shared/studio/avatar-rendering.mjs';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#142130');scene.add(new THREE.HemisphereLight(0xe7efff,0x292a31,1.8));const key=new THREE.DirectionalLight(0xffe6cb,2.8);key.position.set(-3,5,4);scene.add(key);const rim=new THREE.DirectionalLight(0xc0d8ff,1.4);rim.position.set(2,3,-2);scene.add(rim);
const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=environment;pmrem.dispose();
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.05,30);camera.position.set(0,1.38,3.4);camera.lookAt(0,1.15,0);
const table=new THREE.Mesh(new THREE.BoxGeometry(3,.12,1),new THREE.MeshStandardMaterial({color:'#9d6b4f',roughness:.7}));table.position.set(0,.79,.95);scene.add(table);scene.add(new THREE.GridHelper(8,16,0x506273,0x25384a));
const catalogue:MetaHumanCatalogue=await (await fetch('/api/studio/avatar-renderers')).json(),entry=catalogue.models.find(m=>m.status==='ready');if(!entry)throw Error('An inspected Epic MetaHuman is required for this review.');
const character=generateCharacter('00000000-0000-4000-8000-000000000001');character.name='Epic panelist';character.avatar.attributes.accessory='none';
const avatar=new RealisticAvatar(character,'Business_Male_04',environment,()=>{},entry);scene.add(avatar.group);avatar.setSeated(true);avatar.studioTime(true);avatar.setPresence('Listening',false);await avatar.readyForMotions();
for(let i=0;i<600&&avatar.state==='loading';i++)await new Promise(r=>setTimeout(r,50));if(avatar.state!=='ready')throw Error('Epic character did not load');
let track:LipTrack|null=null,text='',audio:HTMLAudioElement|undefined;
function controls(){const values:Record<string,number>={};avatar.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.morphTargetDictionary&&o.morphTargetInfluences)for(const [name,i]of Object.entries(o.morphTargetDictionary))values[name]=Math.max(values[name]||0,o.morphTargetInfluences[i]);});return values;}
function sample(timeMs:number,actionId='',progress=.5,speaking=false,noRender=false){const duration=motionDuration(actionId);avatar.setStudioActions(actionId?performanceSample([{id:'epic-review',characterId:character.id,actionId,atMs:0,durationMs:duration,intensity:.8}],duration*progress,{characterId:character.id}):[],.5);avatar.setPresence(speaking?'Speaking':'Listening',speaking);avatar.animate(timeMs,new THREE.Vector3(0,1.35,3),lipSample(track,timeMs,{playing:speaking}));if(!noRender)renderer.render(scene,camera);const pose=avatar.poseSnapshot();document.querySelector('#label')!.textContent='Epic MetaHuman · '+(speaking?'Hindi · '+timeMs+' ms':actionId||'rest');document.querySelector('#caption')!.textContent=speaking?text:'';return {...pose,faceControls:controls(),render:renderer.info.render,memory:renderer.info.memory};}
(window as any).metaHumanReview={sample,entry,avatar,controls,actions:MOTION_ACTIONS,
  audit:()=>{const meshes:any[]=[];avatar.group.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh))return;const p=o.geometry.getAttribute('position'),w=o.geometry.getAttribute('skinWeight'),j=o.geometry.getAttribute('skinIndex');const examples:any[]=[];for(const i of [0,Math.floor(p.count/2),p.count-1]){const base=new THREE.Vector3().fromBufferAttribute(p,i),posed=o.applyBoneTransform(i,base.clone());examples.push({i,base:base.toArray(),posed:posed.toArray(),weights:[0,1,2,3].map(k=>({w:w.getComponent(i,k),name:o.skeleton.bones[j.getComponent(i,k)]?.name}))});}meshes.push({name:o.name,examples});});return meshes;},
  bind:()=>{avatar.group.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.pose();});avatar.group.updateMatrixWorld(true);renderer.render(scene,camera);return {bounds:new THREE.Box3().setFromObject(avatar.group).min.toArray()};},
  speech:(value:{lips:LipTrack;text:string})=>{track=value.lips;text=value.text;},
  seated:(value:boolean)=>{avatar.setSeated(value);table.visible=value;return sample(0);},
  view:(kind:string)=>{if(kind==='face'){camera.position.set(0,avatar.poseSnapshot().seated?1.16:1.67,1.05);camera.lookAt(0,avatar.poseSnapshot().seated?1.14:1.64,0);}else{camera.position.set(0,1.38,3.4);camera.lookAt(0,1.1,0);}return sample(0);},
  play:async()=>{audio=new Audio('/review-hindi.wav');await audio.play();await new Promise<void>(resolve=>{function frame(){sample(audio!.currentTime*1000,'',.5,true);if(audio!.ended){sample(track!.durationMs);resolve();}else requestAnimationFrame(frame);}frame();});}
};sample(0);document.body.dataset.metaHumanReady='true';
