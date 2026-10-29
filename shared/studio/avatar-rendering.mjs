import {fields,array,token} from './validation.mjs';

// Legacy saved metadata only. Studio playback always uses Rocketbox avatars.

export const DEFAULT_AVATAR_RENDERING=Object.freeze({metaHuman:false,assignments:Object.freeze([])});
export function validateAvatarRendering(value){
  fields(value,['metaHuman','assignments'],'avatar rendering');
  if(typeof value.metaHuman!=='boolean')throw new Error('Invalid legacy avatar flag.');
  const ids=new Set();for(const item of array(value.assignments,100,'avatar assignments')){
    fields(item,['characterId','modelId'],'avatar assignment');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.characterId)||ids.has(item.characterId))throw new Error('Choose distinct saved characters for legacy avatar assignments.');
    token(item.modelId,'legacy avatar model');ids.add(item.characterId);
  }
  return value;
}
export function avatarRendering(value){return structuredClone(validateAvatarRendering(value??DEFAULT_AVATAR_RENDERING));}
