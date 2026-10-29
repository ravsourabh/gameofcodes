import {mkdir,readFile,writeFile,readdir,cp} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';

const project=path.resolve(import.meta.dirname,'../..');
const out=path.join(project,'.sovereign/review',`browser-export-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
await mkdir(out,{recursive:true});console.log('QA artifacts: '+out);
const env={...process.env,GOC_QA_ARTIFACTS:out,GOC_QA_DIST:path.join(out,'dist'),GOC_QA_PORT:process.env.GOC_QA_PORT||'5571',GOC_QA_PROXY:'1',GOC_QA_FIXTURE_TONE:'1'};
async function run(args,file){
  const {createWriteStream}=await import('node:fs');const log=createWriteStream(path.join(out,file));
  const child=spawn(process.execPath,args,{cwd:project,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>{process.stdout.write(data);log.write(data);});child.stderr.on('data',data=>{process.stderr.write(data);log.write(data);});
  return await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{log.end();resolve(code??1);});});
}
async function hashes(){const result={};for(const folder of ['src','server','shared','tests','scripts/qa']){
  async function walk(dir){for(const entry of await readdir(path.join(project,dir),{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(ts|mjs|html|json)$/.test(file))result[file]=createHash('sha256').update(await readFile(path.join(project,file))).digest('hex');}}await walk(folder);
}return result;}
const before=await hashes();await writeFile(path.join(out,'source-before.json'),JSON.stringify(before,null,2));
let code=0;
if(process.env.GOC_QA_SNAPSHOT_DIST==='1'){
  const source=path.resolve(process.env.GOC_QA_SOURCE_DIST||path.join(project,'dist')),indexBefore=await readFile(path.join(source,'index.html'));
  await cp(source,env.GOC_QA_DIST,{recursive:true,errorOnExist:true,force:false});
  const indexAfter=await readFile(path.join(source,'index.html'));
  if(!indexBefore.equals(indexAfter))throw Error('Production index changed during snapshot; rerun after the concurrent build finishes.');
  for(const match of indexBefore.toString().matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)){
    const relative=match[1].slice(1),original=await readFile(path.join(source,relative)),copy=await readFile(path.join(env.GOC_QA_DIST,relative));
    if(!original.equals(copy))throw Error('Production assets changed during snapshot: '+relative);
  }
  await writeFile(path.join(out,'build-snapshot.json'),JSON.stringify({release:JSON.parse(await readFile(path.join(env.GOC_QA_DIST,'release.json'),'utf8')),indexSha256:createHash('sha256').update(indexBefore).digest('hex'),source},null,2));
}else code=await run(['node_modules/vite/bin/vite.js','build','--outDir',env.GOC_QA_DIST],'build.log');
if(!code)code=await run(['node_modules/@playwright/test/cli.js','test','--config','tests/qa/export.playwright.config.ts'],'browser.log');
const after=await hashes();await writeFile(path.join(out,'source-after.json'),JSON.stringify(after,null,2));
await writeFile(path.join(out,'run.json'),JSON.stringify({out,port:env.GOC_QA_PORT,exitCode:code,shortExport:env.GOC_QA_SHORT_EXPORT==='1',fixture:'Explicit offline scripted dialogue and PCM tone; no paid providers or production data',concurrentSourceChanges:Object.keys(after).filter(file=>after[file]!==before[file])},null,2));
console.log('QA artifacts: '+out);process.exitCode=code;
