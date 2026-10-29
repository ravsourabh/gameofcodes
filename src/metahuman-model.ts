import * as THREE from 'three';
import {METAHUMAN_BONES,inspectMetaHumanGltf} from '../shared/studio/avatar-rendering.mjs';
import type {MetaHumanModel} from '../shared/studio/avatar-rendering.mjs';

export function prepareMetaHumanModel(model:THREE.Object3D,gltf:unknown,entry:MetaHumanModel){
  inspectMetaHumanGltf(gltf);
  // Preserve the skeleton hierarchy and bind matrices; only expose canonical
  // names to the existing motion adapter. Finger segments stay distinct.
  for(const [canonical,native] of Object.entries(METAHUMAN_BONES)){
    const bone=model.getObjectByName(native);if(bone instanceof THREE.Bone)bone.name='Bip01_'+canonical.replaceAll(' ','_');
  }
  model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<=0)throw new Error('The MetaHuman mesh has no measurable height.');
  const factor=entry.heightM/height;model.scale.multiplyScalar(factor);model.position.y-=bounds.min.y*factor;model.updateMatrixWorld(true);
  model.traverse(object=>{if(!(object instanceof THREE.Mesh))return;object.frustumCulled=false;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial){const name=material.name.toLowerCase();if(/hair|brow|lash/.test(name)){material.transparent=false;material.alphaTest=.45;material.depthWrite=true;material.side=THREE.DoubleSide;}}});
  return model;
}
