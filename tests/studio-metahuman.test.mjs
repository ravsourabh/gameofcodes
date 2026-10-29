import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {avatarRendering,metaHumanFor,validateAvatarRendering,inspectMetaHumanGltf,metaHumanMorphWeights} from '../shared/studio/avatar-rendering.mjs';
import {createStudioAvatars,inspectMetaHumanGlb} from '../server/studio-avatars.mjs';
import {installMetaHuman} from '../scripts/install-metahuman.mjs';
import {metaHumanRigFixture} from './fixtures/metahuman-rig.mjs';

const actor=randomUUID(),other=randomUUID(),sourceUrl='https://www.fab.com/listings/27a81942-69bf-498e-a41f-004d0d2db37b';
async function fixture(run){const root=await mkdtemp(path.join(tmpdir(),'goc-metahuman-'));try{await run(root);}finally{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-metahuman-'));await rm(root,{recursive:true,force:true});}}

test('MetaHuman is optional per actor; disabling preserves choices without changing saved input',()=>{
  const setting={metaHuman:true,assignments:[{characterId:actor,modelId:'epic-sample-v1'}]},before=structuredClone(setting);assert.equal(metaHumanFor(actor,setting),'epic-sample-v1');assert.equal(metaHumanFor(other,setting),undefined);const off=avatarRendering(setting);off.metaHuman=false;assert.equal(metaHumanFor(actor,off),null);assert.deepEqual(off.assignments,setting.assignments);assert.deepEqual(setting,before);assert.deepEqual(avatarRendering(),{metaHuman:false,assignments:[]});
  assert.throws(()=>validateAvatarRendering({...setting,metaHuman:'yes'}));assert.throws(()=>validateAvatarRendering({...setting,assignments:[...setting.assignments,...setting.assignments]}));assert.throws(()=>validateAvatarRendering({...setting,assignments:[{characterId:actor,modelId:'../../fake'}]}));
});

test('portable MetaHuman assets require a full shared skeleton and baked facial controls',async()=>{
  const bytes=await metaHumanRigFixture();assert.ok(inspectMetaHumanGlb(bytes).bones>20);assert.throws(()=>inspectMetaHumanGlb(bytes.subarray(0,100)),/complete binary/);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.throws(()=>inspectMetaHumanGltf({...gltf,skins:[]}),/combined body/);assert.throws(()=>inspectMetaHumanGltf({...gltf,images:[{uri:'https://external.example/face.png'}]}),/Embed all textures/);assert.throws(()=>inspectMetaHumanGltf({...gltf,meshes:gltf.meshes.map(mesh=>({...mesh,extras:{targetNames:[]}}))}),/Bake facial poses/);assert.throws(()=>inspectMetaHumanGltf({...gltf,nodes:gltf.nodes.map(n=>n.name==='head'?{...n,name:'missing-head'}:n)}),/Missing MetaHuman joints/);
});

test('no asset and failed imports are unavailable; validated immutable imports become ready',()=>fixture(async root=>{
  const service=createStudioAvatars({root});assert.equal((await service.catalogue()).available,false);await assert.rejects(()=>service.validateSelection({metaHuman:true,assignments:[]}),/Import/);
  const input=path.join(root,'test-input.glb'),license=path.join(root,'NOTICE.txt'),bytes=await metaHumanRigFixture();await writeFile(input,bytes);await writeFile(license,'Synthetic MIT fixture, not an Epic character.');const options={root,input,license,id:'test-rig',name:'Synthetic test rig',sourceUrl,heightM:1.75};await installMetaHuman(options);const installed=await service.catalogue();assert.equal(installed.models[0].status,'ready');assert.equal(installed.available,true);await service.validateSelection({metaHuman:true,assignments:[{characterId:actor,modelId:'test-rig'}]});await assert.rejects(()=>installMetaHuman(options),/already imported/);assert.equal((await service.catalogue()).models.length,1);await writeFile(path.join(root,'public/avatars/metahuman/test-rig.glb'),Buffer.from('not a GLB'));const broken=await service.catalogue();assert.equal(broken.models[0].status,'unavailable');await assert.rejects(()=>service.validateSelection({metaHuman:true,assignments:[{characterId:actor,modelId:'test-rig'}]}),/not ready/);await service.validateSelection({metaHuman:false,assignments:[{characterId:actor,modelId:'test-rig'}]});
}));

test('MetaHuman facial translation keeps consonant closure authoritative over jaw reactions',()=>{
  const closed=metaHumanMorphWeights({AA_VI_01_PP:1,AA_VI_10_aa:1,AK_25_JawOpen:1,AA_VI_13_O:1});assert.equal(closed.jawOpen,0);assert.equal(closed.mouthClose,1);assert.equal(closed.mouthFunnel,0);const smile=metaHumanMorphWeights({AK_44_MouthSmileLeft:.7,AK_45_MouthSmileRight:-.2,AK_09_EyeBlinkLeft:.8});assert.equal(smile.mouthSmileLeft,.7);assert.equal(smile.mouthFrownRight,.2);assert.equal(smile.eyeBlinkLeft,.8);assert.ok(Object.values(metaHumanMorphWeights({AA_VI_10_aa:10})).every(value=>value>=0&&value<=1));
});

test('MetaHuman labiodentals address real ARKit lower-lip controls',()=>{
  const weights=metaHumanMorphWeights({AA_VI_02_FF:1});
  assert.equal(weights.mouthRollLower,.7);assert.equal(weights.mouthShrugLower,.55);
  assert.equal(weights.jawOpen,.1);
  assert.equal(weights.mouthLowerUpLeft,undefined);assert.equal(weights.mouthLowerUpRight,undefined);
});

test('a named facial control without corresponding baked geometry is rejected',async()=>{
  const bytes=await metaHumanRigFixture(),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.throws(()=>inspectMetaHumanGltf({...gltf,meshes:gltf.meshes.map(mesh=>({...mesh,primitives:mesh.primitives.map(primitive=>({...primitive,targets:[]}))}))}),/baked position geometry/);
});

test('static clothes cannot pass as a fully animated character',async()=>{
  const bytes=await metaHumanRigFixture(),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.throws(()=>inspectMetaHumanGltf({...gltf,nodes:[...gltf.nodes,{name:'unbound-shirt',mesh:0}]}),/including clothes/);
});
