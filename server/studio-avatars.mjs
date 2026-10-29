import {readFile,lstat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectMetaHumanGltf,validateAvatarRendering} from '../shared/studio/avatar-rendering.mjs';

export function inspectMetaHumanGlb(bytes){
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw new Error('Use a complete binary GLB character export.');
  const length=bytes.readUInt32LE(12);if(length>bytes.length-20)throw new Error('The character export is incomplete.');
  return inspectMetaHumanGltf(JSON.parse(bytes.subarray(20,20+length).toString('utf8')));
}
export function createStudioAvatars({root}){
  const built=existsSync(path.join(root,'dist/avatars/metahuman/catalogue.json')),source=existsSync(path.join(root,'public/avatars/metahuman/catalogue.json'));
  const folder=path.resolve(root,built&&(process.argv.includes('--production')||!source)?'dist':'public','avatars/metahuman'),cache=new Map();
  async function catalogue(){
    let manifest;try{manifest=JSON.parse(await readFile(path.join(folder,'catalogue.json'),'utf8'));}catch{return {schemaVersion:1,models:[],available:false,reason:'Import an optimised MetaHuman character to enable this option.'};}
    if(manifest.schemaVersion!==1||!Array.isArray(manifest.models)||manifest.models.length>20)return {schemaVersion:1,models:[],available:false,reason:'The MetaHuman catalogue needs repair.'};
    const models=[],ids=new Set();for(const model of manifest.models){
      if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(model.id)||ids.has(model.id)||typeof model.name!=='string'||!model.name.trim()||model.name.length>80||!/^https:\/\/(?:www\.)?(?:fab\.com|metahuman\.com|unrealengine\.com|github\.com)\//.test(model.sourceUrl)||!/^[a-f0-9]{64}$/.test(model.sha256)||!Number.isFinite(model.heightM)||model.heightM<1.2||model.heightM>2.2)continue;
      ids.add(model.id);const entry={id:model.id,name:model.name,url:`/avatars/metahuman/${model.id}.glb`,sha256:model.sha256,heightM:model.heightM,sourceUrl:model.sourceUrl,status:'unavailable'};
      try{const file=path.join(folder,model.id+'.glb'),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>64_000_000)throw new Error('Use a self-contained GLB smaller than 64 MB.');
        const key=info.mtimeMs+':'+info.size+':'+model.sha256;let inspected=cache.get(model.id);if(inspected?.key!==key){const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')!==model.sha256)throw new Error('The character file does not match its approved import.');inspectMetaHumanGlb(bytes);inspected={key};cache.set(model.id,inspected);}entry.status='ready';
      }catch(error){entry.reason=error.code==='ENOENT'?'The MetaHuman character file is missing.':error.message;}
      models.push(entry);
    }
    return {schemaVersion:1,models,available:models.some(model=>model.status==='ready'),...(!models.length?{reason:'Import an optimised MetaHuman character to enable this option.'}:{})};
  }
  async function validateSelection(value){validateAvatarRendering(value);if(!value.metaHuman)return;const available=await catalogue();for(const assignment of value.assignments)if(!available.models.some(model=>model.id===assignment.modelId&&model.status==='ready'))throw new Error('This MetaHuman character is not ready. Import and validate its web export first.');if(!available.available)throw new Error(available.reason||'No MetaHuman character is ready.');}
  return {catalogue,validateSelection};
}
