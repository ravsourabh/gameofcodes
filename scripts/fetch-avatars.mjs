// Optional asset-build input. Runtime serves the committed GLBs and needs no network.
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {AVATAR_MODELS} from '../shared/avatar-catalog.mjs';
const root=path.resolve('.sovereign/asset-build/rocketbox');
await mkdir(root,{recursive:true});let tree;
try{tree=JSON.parse(await readFile(path.join(root,'tree.json'),'utf8'));}catch{const response=await fetch('https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/0943055db6ec570bcef9f2c8b41c9e5467c808f9?recursive=1');if(!response.ok)throw new Error('Asset catalogue unavailable');tree=await response.json();await writeFile(path.join(root,'tree.json'),JSON.stringify(tree));}
const names=['Business_Male_02','Business_Female_02','Female_Adult_07'];
const files=tree.tree.filter(f=>f.type==='blob'&&f.path.startsWith('Assets/Avatars/')&&names.some(n=>f.path.includes('/'+n+'/'))&&(/_facial\.fbx$/.test(f.path)||/Textures\/.*_(?:color|normal)\.tga$/.test(f.path)));
files.push(...tree.tree.filter(f=>f.type==='blob'&&f.path.startsWith('Assets/')&&AVATAR_MODELS.some(m=>f.path.endsWith('/'+m.id+'.png'))));
let index=0;await Promise.all(Array.from({length:4},async()=>{while(index<files.length){const file=files[index++],target=path.resolve(root,file.path);if(!target.startsWith(root+path.sep))throw new Error('Invalid asset path');try{if((await stat(target)).size===file.size){if(file.path.endsWith('.png'))await writeFile(path.join(root,path.basename(file.path)),await readFile(target));continue;}}catch{}
const response=await fetch('https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/'+tree.sha+'/'+file.path);if(!response.ok)throw new Error('Asset download '+response.status);const data=new Uint8Array(await response.arrayBuffer());if(data.length!==file.size)throw new Error('Incomplete asset');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);if(file.path.endsWith('.png'))await writeFile(path.join(root,path.basename(file.path)),data);}}));
console.log(JSON.stringify({downloadedModels:names,sourceRevision:tree.sha,files:files.length}));
