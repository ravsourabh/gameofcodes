import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const retired=[
  'server/preview.mjs','server/court.mjs','server/providers.mjs','server/protocol.mjs',
  'src/court-main.ts','src/scene.ts','src/preview.ts',
  'src/legacy-session-main.ts','src/session-scene.ts','src/character-workshop.ts',
  'src/session-conversation.ts','src/guide-setup.ts','src/session-discussion.ts',
  'src/session.css','src/characters.css','src/environment-assets.ts',
  'src/throne-court.ts','src/roundtable.ts','src/broadcast-camera.ts',
  'shared/interface-intents.mjs','shared/interface-intents.d.mts','public/crown.svg',
];
test('Studio application import graph resolves without retired coding or Council interfaces',async()=>{
  const visited=new Set();
  async function visit(file){
    if(visited.has(file))return;visited.add(file);const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|new\s+URL\s*\(\s*)['"](\.[^'"\r\n]+)['"]/g)){
      const base=path.resolve(path.dirname(file),match[1]);let dependency;
      for(const candidate of [base,base+'.ts',base+'.mjs',base+'.css']){try{await access(candidate);dependency=candidate;break;}catch{}}
      assert.ok(dependency,`Missing import ${match[1]} in ${file}`);await visit(dependency);
    }
  }
  for(const entry of ['src/session-main.ts','scripts/dev.mjs','server/session-server.mjs'])await visit(path.join(root,entry));
  for(const entry of ['src/studio-main.ts','src/studio-scene.ts','src/court-surfaces.ts','src/realistic-avatar.ts','src/studio-motion.ts'])assert.ok(visited.has(path.join(root,entry)),`Studio still needs ${entry}`);
  for(const entry of retired){assert.equal(visited.has(path.join(root,entry)),false);await assert.rejects(access(path.join(root,entry)),{code:'ENOENT'});}
  assert.match(await readFile(path.join(root,'index.html'),'utf8'),/src\/session-main\.ts/);
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(manifest.scripts['dev:legacy'],undefined);assert.equal(manifest.dependencies.ws,undefined);
});
test('retired launcher fails before starting any application service',()=>{
  const result=spawnSync(process.execPath,['scripts/dev.mjs','--legacy'],{cwd:root,encoding:'utf8',timeout:15000});
  assert.equal(result.status,1);assert.match(result.stderr,/coding-preview entry is retired/);assert.doesNotMatch(result.stdout,/Local:|localhost:|127\.0\.0\.1:/);
});
