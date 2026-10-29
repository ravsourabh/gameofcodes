import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {publishingKitInputs,kitPath} from './copy-publishing-kit.mjs';

// Package an explicit runtime source tree; never use the whole working directory
// as a Docker context. User records and authoring references stay local.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.sovereign/releases');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[];
async function collect(relative){
 const location=path.join(root,relative),info=await fs.lstat(location);
 if(info.isSymbolicLink())throw new Error('Release inputs cannot be symbolic links: '+relative);
 if(info.isDirectory()){
  if(/(?:^|\/)(?:metahuman|node_modules|\.sovereign|concept|archive)(?:\/|$)/i.test(relative))return;
  for(const name of (await fs.readdir(location)).sort())await collect(relative+'/'+name);
 }else{
  if(/(?:^|\/)(?:\.[^/]+|client_secret[^/]*|sovereign\.env)(?:\/|$)/i.test(relative)||/\.(?:key|pem|uasset|umap|uproject|fbx|zip|psd|blend)$/i.test(relative))throw new Error('Private/authoring input in release: '+relative);
  files.push(relative);
 }
}
for(const name of ['src','server','shared','public'])await collect(name);
const kit=JSON.parse(await fs.readFile(path.join(root,kitPath,'manifest.json'),'utf8'));
for(const name of new Set([...publishingKitInputs,...kit.assets.map(asset=>asset.file)])){
 if(!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(name)||name.split('/').some(part=>part.startsWith('.')))throw new Error('Invalid kit input.');
 await collect(kitPath+'/'+name);
}
for(const name of ['package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','Dockerfile','compose.release.yml','.dockerignore'])files.push(name);
for(const name of (await fs.readdir(path.join(root,'scripts'))).sort())if(/\.(mjs|sh)$/.test(name)&&!name.includes('metahuman'))files.push('scripts/'+name);
const manifest={};for(const name of files.sort())manifest[name]=sha(await fs.readFile(path.join(root,name)));
const revision='studio-'+sha(JSON.stringify(manifest)).slice(0,16);
await fs.mkdir(output,{recursive:true});
const stage=await fs.mkdtemp(path.join(output,revision+'-'));
for(const name of files){await fs.mkdir(path.dirname(path.join(stage,name)),{recursive:true});await fs.copyFile(path.join(root,name),path.join(stage,name));}
const run=(bin,args,options={})=>{const result=spawnSync(bin,args,{cwd:stage,stdio:'inherit',...options});if(result.status!==0)throw new Error('Release command failed: '+bin);};
if(!process.argv.includes('--skip-build')){
 const resolve=createRequire(import.meta.url);
 run(process.execPath,[path.join(path.dirname(resolve.resolve('typescript/package.json')),'bin/tsc'),'--noEmit']);
 run(process.execPath,[path.join(path.dirname(resolve.resolve('vite/package.json')),'bin/vite.js'),'build'],{env:{...process.env,GOC_BUILD_REVISION:revision}});
 const release=JSON.parse(await fs.readFile(path.join(stage,'dist/release.json'),'utf8'));
 if(release.revision!==revision)throw new Error('Built release identity does not match source.');
 const stat=await fs.stat(path.join(stage,'dist/publishing/baat-ka-bawaal/v1/index.html'));if(!stat.size)throw new Error('Publishing kit missing.');
 try{await fs.access(path.join(stage,'dist/avatars/metahuman'));throw new Error('Pruned renderer assets found in release.');}catch(e){if(e.code!=='ENOENT')throw e;}
}
for(const name of files){
 if(sha(await fs.readFile(path.join(stage,name)))!==manifest[name])throw new Error('Snapshot changed while building: '+name);
 if(sha(await fs.readFile(path.join(root,name)))!==manifest[name])throw new Error('Working source changed while building; freeze edits and rebuild: '+name);
}
await fs.writeFile(path.join(stage,'release-manifest.json'),JSON.stringify({revision,files:manifest},null,2)+'\n');
await fs.writeFile(path.join(stage,'archive-files.txt'),[...files,'release-manifest.json'].join('\n')+'\n');
const archive=path.join(output,revision+'.tgz');
run('tar',['-czf',archive,'-T','archive-files.txt']);
const result={revision,stage,archive,archiveSha256:sha(await fs.readFile(archive)),files:files.length};
await fs.writeFile(path.join(output,'latest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
