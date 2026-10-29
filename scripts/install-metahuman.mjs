// Install a deliberately exported, self-contained MetaHuman GLB. Does not fetch
// private Epic content, accept licences or mislabel a Rocketbox person.
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {inspectMetaHumanGlb} from '../server/studio-avatars.mjs';
import {replaceFile} from '../server/atomic-file.mjs';

export async function installMetaHuman({root,input,id,name,sourceUrl,heightM=1.75,license}){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)||typeof name!=='string'||!name.trim()||name.length>80||!/^https:\/\/(?:www\.)?(?:fab\.com|metahuman\.com|unrealengine\.com|github\.com)\//.test(sourceUrl)||!Number.isFinite(heightM)||heightM<1.2||heightM>2.2)throw new Error('Provide a model ID, name, official source URL and height between 1.2 and 2.2 metres.');
  const info=await lstat(input);if(!info.isFile()||info.isSymbolicLink()||info.size>64_000_000)throw new Error('Use a self-contained GLB smaller than 64 MB.');
  const bytes=await readFile(input);const inspected=inspectMetaHumanGlb(bytes),notice=await readFile(license,'utf8');if(!notice.trim()||notice.length>200000)throw new Error('Retain the source asset licence/notice.');
  const dir=path.resolve(root,'public/avatars/metahuman');await mkdir(dir,{recursive:true});let catalogue;
  try{catalogue=JSON.parse(await readFile(path.join(dir,'catalogue.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;catalogue={schemaVersion:1,models:[]};}
  if(catalogue.schemaVersion!==1||!Array.isArray(catalogue.models)||catalogue.models.length>=20)throw new Error('Repair the MetaHuman catalogue before importing.');
  if(catalogue.models.some(model=>model.id===id))throw new Error('That model ID is already imported. Use a new version ID to preserve saved takes.');
  // Unique identities make accepted takes refer to immutable asset revisions.
  for(const target of [id+'.glb',id+'.LICENSE.txt']){try{await lstat(path.join(dir,target));throw new Error('A file already uses this import ID.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  await writeFile(path.join(dir,id+'.glb'),bytes,{flag:'wx'});await writeFile(path.join(dir,id+'.LICENSE.txt'),notice,{flag:'wx'});
  const model={id,name,sourceUrl,heightM,sha256:createHash('sha256').update(bytes).digest('hex'),license:id+'.LICENSE.txt',importedAt:new Date().toISOString()};catalogue.models.push(model);
  const pending=path.join(dir,'catalogue.'+randomUUID()+'.tmp');await writeFile(pending,JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});await replaceFile(pending,path.join(dir,'catalogue.json'));return {...model,...inspected};
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2),get=key=>args[args.indexOf(key)+1];
  try{for(const key of ['--input','--id','--name','--source','--license'])if(!args.includes(key))throw new Error('Usage: node scripts/install-metahuman.mjs --input character.glb --id epic-sample-v1 --name "Epic sample" --source https://www.fab.com/listings/... --license NOTICE.txt [--height 1.75]');console.log(JSON.stringify(await installMetaHuman({root:process.cwd(),input:path.resolve(get('--input')),id:get('--id'),name:get('--name'),sourceUrl:get('--source'),license:path.resolve(get('--license')),heightM:args.includes('--height')?Number(get('--height')):1.75}),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
