// Synthetic rig adapter fixture, derived from an existing MIT Rocketbox GLB.
// This is NOT an Epic character and must never be installed/shipped as one.
import {readFile} from 'node:fs/promises';
import {METAHUMAN_BONES} from '../../shared/studio/avatar-rendering.mjs';
export async function metaHumanRigFixture(){
  const bytes=await readFile(new URL('../../public/avatars/rocketbox/Business_Male_04.glb',import.meta.url)),size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString());
  for(const [canonical,native] of Object.entries(METAHUMAN_BONES)){const node=gltf.nodes.find(n=>n.name===`Bip01_${canonical.replaceAll(' ','_')}`||n.name===`Bip01 ${canonical}`);if(node)node.name=native;}
  const names={AA_VI_10_aa:'jawOpen',AA_VI_01_PP:'mouthClose',AA_VI_13_O:'mouthFunnel',AA_VI_14_U:'mouthPucker',AA_VI_02_FF:'mouthRollLower',AA_VI_06_CH:'mouthShrugLower',AK_44_MouthSmileLeft:'mouthSmileLeft',AK_45_MouthSmileRight:'mouthSmileRight',AK_09_EyeBlinkLeft:'eyeBlinkLeft',AK_10_EyeBlinkRight:'eyeBlinkRight',AK_03_BrowInnerUp:'browInnerUp',AK_04_BrowOuterUpLeft:'browOuterUpLeft',AK_05_BrowOuterUpRight:'browOuterUpRight'};
  for(const mesh of gltf.meshes||[])if(mesh.extras?.targetNames)mesh.extras.targetNames=mesh.extras.targetNames.map(name=>names[name]||name);
  gltf.asset.extras={syntheticRigFixture:true,notice:'MIT Rocketbox geometry for adapter tests only; not an Epic MetaHuman.'};
  const json=Buffer.from(JSON.stringify(gltf)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(padded.length);jsonHeader.writeUInt32LE(0x4e4f534a,4);const tail=bytes.subarray(20+size),header=Buffer.from(bytes.subarray(0,12));header.writeUInt32LE(12+8+padded.length+tail.length,8);return Buffer.concat([header,jsonHeader,padded,tail]);
}
