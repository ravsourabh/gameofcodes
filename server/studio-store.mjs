import {mkdir, lstat, readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {replaceFile} from './atomic-file.mjs';
import {isId, SessionError} from '../shared/session-domain.mjs';

const fail=(message,code='STORAGE_CONFLICT')=>{throw new SessionError(message,409,code);};
// One service owns the store in this process, matching the existing session service.
// Revisions protect competing clients; atomic rename protects acknowledged saves.
export function createStudioStore({root,validate,replace=replaceFile}){
  const base=path.resolve(root),locks=new Map();
  async function serial(key,operation){
    const work=(locks.get(key)||Promise.resolve()).catch(()=>{}).then(operation);locks.set(key,work);
    try{return await work;}finally{if(locks.get(key)===work)locks.delete(key);}
  }
  async function directory(profileId,collection,create=false){
    if(!isId(profileId)||!['channels','episodes','characters'].includes(collection))throw new SessionError('Invalid studio location.');
    const parts=[base];for(const segment of ['.sovereign','studio','v1',profileId,collection])parts.push(path.join(parts.at(-1),segment));
    for(const folder of parts){
      let info;
      try{info=await lstat(folder);}catch(error){
        if(error.code!=='ENOENT')throw error;if(!create)return null;
        try{await mkdir(folder);}catch(error){if(error.code!=='EEXIST')throw error;}
        info=await lstat(folder);
      }
      if(!info.isDirectory()||info.isSymbolicLink())fail('Studio storage is unavailable. Existing data has been kept.');
    }
    return parts.at(-1);
  }
  async function load(profileId,collection,id){
    if(!isId(id))throw new SessionError('Invalid studio record identifier.');
    const folder=await directory(profileId,collection);if(!folder)return null;
    let saved;
    try{
      const file=path.join(folder,`${id}.json`),info=await lstat(file);
      if(!info.isFile()||info.isSymbolicLink()||info.size>8_000_000)fail('This studio record cannot be read safely. It has not been changed.','INVALID_STUDIO_RECORD');
      try{saved=JSON.parse(await readFile(file,'utf8'));}catch{fail('Unreadable studio record. It has not been changed.','INVALID_STUDIO_RECORD');}
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(saved?.schemaVersion!==1)fail('This studio schema is unsupported. The record has been kept.','UNSUPPORTED_SCHEMA');
    try{validate(saved,collection);}catch{fail('Inconsistent studio record. It has not been changed.','INVALID_STUDIO_RECORD');}
    if(saved.id!==id||saved.profileId!==profileId)fail('Studio identity does not match its location.','INVALID_STUDIO_RECORD');
    return saved;
  }
  async function persist(record,collection){
    validate(record,collection);const content=JSON.stringify(record,null,2);
    if(Buffer.byteLength(content)>8_000_000)throw new SessionError('This studio record has reached its storage limit.',413,'STUDIO_LIMIT');
    const folder=await directory(record.profileId,collection,true),target=path.join(folder,`${record.id}.json`);
    // Also reject file symlinks on a first-save race; never replace a redirected file.
    try{const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile())fail('Studio target is unavailable.');}catch(error){if(error.code!=='ENOENT')throw error;}
    const temporary=path.join(folder,`${record.id}.${randomUUID()}.tmp`);
    await writeFile(temporary,content,{flag:'wx'});await replace(temporary,target);
  }
  async function list(profileId,collection){
    const folder=await directory(profileId,collection);if(!folder)return {records:[],unavailableCount:0};
    const records=[];let unavailableCount=0;
    const files=(await readdir(folder)).filter(file=>/^[0-9a-f-]{36}\.json$/.test(file)).sort();
    if(files.length>1000)throw new SessionError('This studio collection has reached its listing limit.',413);
    for(const file of files){try{const saved=await load(profileId,collection,file.slice(0,-5));if(saved)records.push(saved);}catch(error){if(error instanceof SessionError)unavailableCount++;else throw error;}}
    return {records:records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),unavailableCount};
  }
  return {serial,load,persist,list};
}
