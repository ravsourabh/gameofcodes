import {mkdir,readFile,writeFile,lstat,access,chmod} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),version='1.14.0',platform=process.platform==='win32'?'Windows':process.platform==='linux'?'Linux':null;
if(!platform)throw new Error('Install Rhubarb 1.14.0 manually for this platform and set RHUBARB_PATH.');
const hashes={Windows:'62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3',Linux:'a9a9074862cff47b2d59b8bf399a678a3b0b74f9452ad6ad94cb292913dd8667'};
const tools=path.join(root,'.sovereign','tools'),folder=path.join(tools,'rhubarb'),name=`Rhubarb-Lip-Sync-${version}-${platform}`,executable=path.join(folder,name,platform==='Windows'?'rhubarb.exe':'rhubarb');
for(const dir of [path.join(root,'.sovereign'),tools]){await mkdir(dir,{recursive:true});const info=await lstat(dir);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Unsafe local tool directory.');}
try{await access(executable);console.log('Local lip-sync aligner is already installed.');process.exit(0);}catch{}
const zip=path.join(tools,name+'.zip');let bytes;
try{bytes=await readFile(zip);}catch{const response=await fetch(`https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${version}/${name}.zip`);if(!response.ok)throw new Error('The official lip-sync archive could not be downloaded.');bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>120000000)throw new Error('Tool archive too large.');await writeFile(zip,bytes,{flag:'wx'});}
if(createHash('sha256').update(bytes).digest('hex')!==hashes[platform])throw new Error('The lip-sync archive checksum does not match the pinned release.');
// Refuse escaping names before handing the pinned archive to a native extractor.
for(let offset=0;offset<bytes.length-46;offset++)if(bytes.readUInt32LE(offset)===0x02014b50){const size=bytes.readUInt16LE(offset+28),entry=bytes.subarray(offset+46,offset+46+size).toString();if(/(^[\/\\]|^[a-z]:|(^|[\/\\])\.\.([\/\\]|$))/i.test(entry))throw new Error('Unsafe archive entry.');offset+=45+size+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);}
await mkdir(folder,{recursive:true});if((await lstat(folder)).isSymbolicLink())throw new Error('Unsafe tool target.');
const command=platform==='Windows'?'powershell.exe':'unzip',args=platform==='Windows'?['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/unpack-lip-sync.ps1'),'-Archive',zip,'-Destination',folder]:['-q',zip,'-d',folder];
await new Promise((resolve,reject)=>{const child=spawn(command,args,{shell:false,windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Could not unpack the verified aligner.')));});
await access(executable);if(platform==='Linux')await chmod(executable,0o755);console.log('Installed pinned Rhubarb 1.14.0 for final-audio mouth alignment.');
