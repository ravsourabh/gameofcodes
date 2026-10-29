import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
test('default application import graph resolves without the retired coding services or entry',async()=>{
  const visited=new Set(),retired=['server/preview.mjs','server/court.mjs','server/providers.mjs','server/protocol.mjs','src/court-main.ts','src/scene.ts','src/preview.ts'];
  async function visit(file){
    if(visited.has(file))return;visited.add(file);const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|new\s+URL\s*\(\s*)['"](\.[^'"\r\n]+)['"]/g)){
      const base=path.resolve(path.dirname(file),match[1]);let dependency;
      for(const candidate of [base,base+'.ts',base+'.mjs',base+'.css']){try{await access(candidate);dependency=candidate;break;}catch{}}
      assert.ok(dependency,`Missing import ${match[1]} in ${file}`);await visit(dependency);
    }
  }
  for(const entry of ['src/session-main.ts','scripts/dev.mjs','server/session-server.mjs'])await visit(path.join(root,entry));
  assert.ok(visited.size>35);
  for(const entry of retired){assert.equal(visited.has(path.join(root,entry)),false);await assert.rejects(access(path.join(root,entry)));await access(path.join(root,'archive/legacy-coding',entry));}
  assert.match(await readFile(path.join(root,'index.html'),'utf8'),/src\/session-main\.ts/);
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(manifest.scripts['dev:legacy'],undefined);assert.equal(manifest.dependencies.ws,undefined);
});
test('retired launcher fails before starting any application service',()=>{
  const result=spawnSync(process.execPath,['scripts/dev.mjs','--legacy'],{cwd:root,encoding:'utf8',timeout:15000});
  assert.equal(result.status,1);assert.match(result.stderr,/coding-preview entry is retired/);assert.doesNotMatch(result.stdout,/Local:|localhost:|127\.0\.0\.1:/);
});
