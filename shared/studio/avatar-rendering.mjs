import {fields,array,token} from './validation.mjs';

export const DEFAULT_AVATAR_RENDERING=Object.freeze({metaHuman:false,assignments:Object.freeze([])});
export function validateAvatarRendering(value){
  fields(value,['metaHuman','assignments'],'avatar rendering');
  if(typeof value.metaHuman!=='boolean')throw new Error('Choose whether MetaHuman is enabled.');
  const ids=new Set();for(const item of array(value.assignments,100,'avatar assignments')){
    fields(item,['characterId','modelId'],'avatar assignment');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.characterId)||ids.has(item.characterId))throw new Error('Choose distinct saved characters for MetaHuman.');
    token(item.modelId,'MetaHuman model');ids.add(item.characterId);
  }
  return value;
}
export function avatarRendering(value){return structuredClone(validateAvatarRendering(value??DEFAULT_AVATAR_RENDERING));}
export function metaHumanFor(characterId,value){return value?.metaHuman?value.assignments.find(item=>item.characterId===characterId)?.modelId:null;}

// Portable GLBs use a single body/face skeleton and baked facial morphs. Raw
// MetaHuman DNA/RigLogic is deliberately not advertised as browser-ready.
export const METAHUMAN_BONES=Object.freeze({Pelvis:'pelvis',Spine:'spine_01',Spine1:'spine_03',Spine2:'spine_05',Neck:'neck_01',Head:'head',LEye:'FACIAL_L_Eye',REye:'FACIAL_R_Eye',...Object.fromEntries(['L','R'].flatMap(side=>{
  const suffix=side.toLowerCase(),parts={Clavicle:'clavicle',UpperArm:'upperarm',Forearm:'lowerarm',Hand:'hand',Thigh:'thigh',Calf:'calf',Foot:'foot',Toe0:'ball'};
  return [...Object.entries(parts).map(([key,native])=>[`${side} ${key}`,`${native}_${suffix}`]),...['thumb','index','middle','ring','pinky'].flatMap((finger,index)=>[1,2,3].map(segment=>[`${side} Finger${index}${segment===1?'':segment-1}`,`${finger}_0${segment}_${suffix}`]))];
}))});
export const METAHUMAN_REQUIRED_BONES=['pelvis','spine_01','spine_03','spine_05','neck_01','head','clavicle_l','clavicle_r','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r','ball_l','ball_r','FACIAL_L_Eye','FACIAL_R_Eye'];
export const METAHUMAN_REQUIRED_MORPHS=['jawOpen','mouthClose','mouthFunnel','mouthPucker','mouthRollLower','mouthShrugLower','mouthSmileLeft','mouthSmileRight','eyeBlinkLeft','eyeBlinkRight','browInnerUp','browOuterUpLeft','browOuterUpRight'];
export function inspectMetaHumanGltf(gltf){
  if(gltf.asset?.version!=='2.0')throw new Error('Use a glTF 2.0 binary character export.');
  if(gltf.extensionsRequired?.some(name=>!['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_texture_transform','KHR_mesh_quantization','EXT_texture_webp'].includes(name)))throw new Error('Re-export without unsupported compression/extensions.');
  if([...(gltf.buffers||[]),...(gltf.images||[])].some(item=>item.uri))throw new Error('Embed all textures and buffers in the GLB.');
  const nodes=gltf.nodes||[],skins=gltf.skins||[],joints=new Set(skins.flatMap(skin=>skin.joints||[])),names=new Set([...joints].map(index=>nodes[index]?.name));
  if(skins.length!==1)throw new Error('Export one combined body/face skeleton for the web character.');
  const missing=METAHUMAN_REQUIRED_BONES.filter(name=>!names.has(name));if(missing.length)throw new Error('Missing MetaHuman joints: '+missing.join(', '));
  const duplicates=METAHUMAN_REQUIRED_BONES.filter(name=>[...joints].filter(index=>nodes[index]?.name===name).length!==1);if(duplicates.length)throw new Error('The body and face need one shared skeleton.');
  const morphs=new Set((gltf.meshes||[]).flatMap(mesh=>mesh.extras?.targetNames||[])),missingFaces=METAHUMAN_REQUIRED_MORPHS.filter(name=>!morphs.has(name));
  if(missingFaces.length)throw new Error('Bake facial poses into named ARKit morphs before export: '+missingFaces.join(', '));
  // A list of control names is not a baked face. Every required control must
  // address a real position target with the same vertex count as its primitive.
  const baked=new Set();for(const mesh of gltf.meshes||[])for(const primitive of mesh.primitives||[]){
    const count=gltf.accessors?.[primitive.attributes?.POSITION]?.count;
    for(const [index,name] of (mesh.extras?.targetNames||[]).entries()){
      const accessor=gltf.accessors?.[primitive.targets?.[index]?.POSITION];
      if(accessor?.type==='VEC3'&&accessor.componentType===5126&&accessor.count===count&&(accessor.bufferView!==undefined||accessor.sparse?.count>0))baked.add(name);
    }
  }
  if(METAHUMAN_REQUIRED_MORPHS.some(name=>!baked.has(name)))throw new Error('Facial controls need baked position geometry, not only target names.');
  if(!(gltf.meshes||[]).some(mesh=>mesh.primitives?.some(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined)))throw new Error('A skinned character mesh is required.');
  if(nodes.some(node=>node.mesh!==undefined&&(node.skin!==0||!gltf.meshes?.[node.mesh]?.primitives?.every(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined))))throw new Error('Bind every character part, including clothes, to the shared skeleton.');
  return {bones:names.size,morphs:morphs.size};
}

// Rhubarb/Rocketbox articulation is translated into baked ARKit controls. A
// closing consonant owns jaw closure; expressions may not reopen the mouth.
export function metaHumanMorphWeights(values){
  const result={},put=(name,value)=>{result[name]=Math.max(result[name]||0,Math.min(1,Math.max(0,value||0)));};
  const expressions={AK_09_EyeBlinkLeft:'eyeBlinkLeft',AK_10_EyeBlinkRight:'eyeBlinkRight',AK_03_BrowInnerUp:'browInnerUp',AK_04_BrowOuterUpLeft:'browOuterUpLeft',AK_05_BrowOuterUpRight:'browOuterUpRight',AK_25_JawOpen:'jawOpen'};
  for(const [key,name] of Object.entries(expressions))put(name,values[key]);
  put('browDownLeft',-(values.AK_04_BrowOuterUpLeft||0));put('browDownRight',-(values.AK_05_BrowOuterUpRight||0));
  for(const [side,key] of [['Left','AK_44_MouthSmileLeft'],['Right','AK_45_MouthSmileRight']]){const value=values[key]||0;put('mouthSmile'+side,value);put('mouthFrown'+side,-value);}
  const jaw={AA_VI_03_TH:.30,AA_VI_04_DD:.22,AA_VI_05_kk:.40,AA_VI_06_CH:.27,AA_VI_07_SS:.12,AA_VI_08_nn:.20,AA_VI_09_RR:.32,AA_VI_10_aa:.85,AA_VI_11_E:.50,AA_VI_12_I:.32,AA_VI_13_O:.60,AA_VI_14_U:.30};for(const [key,weight] of Object.entries(jaw))put('jawOpen',(values[key]||0)*weight);
  put('mouthFunnel',Math.max(values.AA_VI_13_O||0,(values.AA_VI_06_CH||0)*.4));put('mouthPucker',values.AA_VI_14_U);put('mouthStretchLeft',(values.AA_VI_11_E||0)*.6);put('mouthStretchRight',(values.AA_VI_11_E||0)*.6);
  // ARKit has no mouthLowerUpLeft/Right controls. Labiodentals use the lower
  // lip roll and shrug to bring the lip towards the upper teeth.
  const labiodental=Math.min(1,Math.max(0,values.AA_VI_02_FF||0));put('mouthRollLower',labiodental*.7);put('mouthShrugLower',labiodental*.55);put('jawOpen',labiodental*.1);
  const close=Math.min(1,Math.max(0,values.AA_VI_01_PP||0));if(close>0){result.jawOpen=(result.jawOpen||0)*(1-close);put('mouthClose',close);result.mouthFunnel=(result.mouthFunnel||0)*(1-close);result.mouthPucker=(result.mouthPucker||0)*(1-close);}
  return result;
}
