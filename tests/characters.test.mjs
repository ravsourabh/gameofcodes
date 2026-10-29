import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateCharacter, appearanceFromSeed, rerollAppearance, characterFields, validateAppearance } from '../shared/character-domain.mjs';
import {createCharacterLibrary} from '../server/character-library.mjs';
import {createSession,updateRoster,validateSession} from '../shared/session-domain.mjs';
import {modelForAppearance,AVATAR_MODELS} from '../shared/avatar-catalog.mjs';

const fields = actor => characterFields(Object.fromEntries(['name','personality','code','avatar','voicePreference'].map(key=>[key,actor[key]])));

test('reserved people are never generated and appended models keep older characters\' faces', () => {
 const reserved=new Set(AVATAR_MODELS.filter(m=>m.reserved).map(m=>m.id)),original=AVATAR_MODELS.slice(0,6).map(m=>m.id);
 assert.ok(reserved.size>0);
 for(let seed=0;seed<400;seed++){
  const generated=appearanceFromSeed(seed);assert.ok(!reserved.has(generated.realistic.modelId));
  assert.ok(!reserved.has(rerollAppearance(generated,[],seed+1,'model').realistic.modelId));
  assert.equal(modelForAppearance({seed,attributes:generated.attributes}),original[seed%6]);
 }
});

test('appearance generation is deterministic and partial rerolls preserve explicit kept attributes', () => {
  for (const seed of [0, 72, 0x80000000, 0xffffffff]) {
    const character = generateCharacter(randomUUID(), { seed });
    assert.deepEqual(character.avatar, appearanceFromSeed(seed)); assert.equal(validateAppearance(character.avatar), character.avatar);
  }
  const avatar = appearanceFromSeed(42), rerolled = rerollAppearance(avatar, ['hair', 'skin'], 123);
  assert.equal(rerolled.attributes.hair, avatar.attributes.hair); assert.equal(rerolled.attributes.skin, avatar.attributes.skin);
  assert.notEqual(rerolled.attributes.beard, avatar.attributes.beard);
  const onlyBeard = rerollAppearance(avatar, [], 50, 'beard');
  for (const key of Object.keys(avatar.attributes)) assert.equal(onlyBeard.attributes[key] === avatar.attributes[key], key !== 'beard');
  assert.throws(() => rerollAppearance(avatar, ['__proto__']), /Invalid/);
  assert.throws(() => validateAppearance({ ...avatar, attributes: { ...avatar.attributes, hair: 'unsupported' } }));
  assert.throws(() => validateAppearance({ ...avatar, priorContext: 'A different session' }), /Unexpected/);
});
test('human identity is explicit or deterministically derived for old records and survives kept rerolls',()=>{
 const a=appearanceFromSeed(42),legacy={seed:42,attributes:{...a.attributes}};assert.equal(modelForAppearance(legacy),modelForAppearance(a));
 const edited={...a,realistic:{modelId:'Business_Female_02'}};assert.equal(modelForAppearance(rerollAppearance(edited,['model'],55)),edited.realistic.modelId);
 assert.equal(modelForAppearance(rerollAppearance(edited,[],55,'colour')),edited.realistic.modelId);assert.notEqual(modelForAppearance(rerollAppearance(edited,[],55,'model')),edited.realistic.modelId);
 assert.throws(()=>validateAppearance({...a,realistic:{modelId:'../../private'}}),/bundled/);
});


async function fixture(run){
 const root=await mkdtemp(path.join(tmpdir(),'goc-characters-test-')),profile=randomUUID();let library=createCharacterLibrary({root});
 try{await run({root,profile,get library(){return library;},restart:()=>{library=createCharacterLibrary({root});}});}
 finally{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'goc-characters-test-'));await rm(root,{recursive:true,force:true});}
}

test('legacy library bootstrap, edits, preferences and retry receipts remain durable for Studio',()=>fixture(async context=>{
 const {profile}=context,results=await Promise.all(Array.from({length:4},()=>context.library.get(profile))),initial=results[0];
 assert.ok(results.every(item=>item.guideId===initial.guideId));assert.equal(initial.characters[0].name,'Virus');assert.ok(Object.values(initial.guideProgress.lessons).every(status=>status==='pending'));
 const actor=generateCharacter(profile),input={requestId:randomUUID(),expectedRevision:initial.revision,action:'create',id:actor.id,character:fields(actor)};
 const created=await context.library.mutate(profile,input);assert.equal((await context.library.mutate(profile,input)).replayed,true);
 const edit={requestId:randomUUID(),expectedRevision:created.library.revision,action:'update',id:actor.id,character:{...fields(actor),name:'Noor',code:'Ask for evidence.',voicePreference:{style:'crisp',pace:'brisk'}}};
 const edited=(await context.library.mutate(profile,edit)).library;context.restart();assert.deepEqual(await context.library.get(profile),edited);assert.equal((await context.library.mutate(profile,edit)).replayed,true);
 const restored=edited.characters.find(item=>item.id===actor.id);assert.equal(restored.name,'Noor');assert.deepEqual(restored.avatar,actor.avatar);assert.deepEqual(restored.voicePreference,edit.character.voicePreference);
 await assert.rejects(context.library.mutate(profile,{...edit,requestId:randomUUID()}),error=>error.status===409);
 await assert.rejects(context.library.mutate(profile,{...edit,character:{...edit.character,code:'Changed retry'}}),error=>error.status===409);
 assert.notEqual((await context.library.get(randomUUID())).guideId,initial.guideId);
}));

test('legacy library rejects foreign identities and unexpected character fields',()=>fixture(async({library,profile})=>{
 const initial=await library.get(profile),actor=generateCharacter(profile),input={requestId:randomUUID(),expectedRevision:initial.revision,action:'create',id:actor.id,character:fields(actor)};
 const saved=(await library.mutate(profile,input)).library,edit={...input,requestId:randomUUID(),expectedRevision:saved.revision,action:'update'};
 await assert.rejects(library.mutate(randomUUID(),{...edit,expectedRevision:1}),error=>error.status===404);
 for(const fields of [{history:['Private context']},{brain:{provider:'invented',model:'invented'}},{avatar:{...actor.avatar,attributes:{...actor.avatar.attributes,clothes:'unsupported'}}}])await assert.rejects(library.mutate(profile,{...edit,character:{...edit.character,...fields}}),error=>error.status===400);
}));

test('legacy session snapshots retain their identity and roles when a library character is edited',()=>fixture(async({library,profile})=>{
 const initial=await library.get(profile),actor=generateCharacter(profile),guide=initial.characters.find(item=>item.id===initial.guideId);
 const created=(await library.mutate(profile,{requestId:randomUUID(),expectedRevision:initial.revision,action:'create',id:actor.id,character:fields(actor)})).library;
 let session=createSession({profileId:profile,requestId:randomUUID(),guide,draft:{title:'Preserved snapshot',mode:'discussion',situation:'Choose a test.'}});
 const roster={requestId:randomUUID(),expectedRevision:session.revision,entries:[{characterId:actor.id,role:'Critic',code:'Session priority.'}]};session=updateRoster(session,roster,created.characters);assert.equal(updateRoster(session,roster,created.characters),session);
 const edited=(await library.mutate(profile,{requestId:randomUUID(),expectedRevision:created.revision,action:'update',id:actor.id,character:{...fields(actor),name:'Updated library identity',code:'New default.'}})).library;
 assert.equal(session.characters[0].name,actor.name);assert.equal(session.participants[0].code,'Session priority.');assert.equal(edited.characters.find(item=>item.id===actor.id).name,'Updated library identity');validateSession(session);
}));

test('corrupt/future legacy libraries and storage junctions do not reset or redirect saved data',()=>fixture(async({root,library,profile})=>{
 await library.get(profile);const file=path.join(root,'.sovereign','characters','v1',profile,'library.json'),original=await readFile(file,'utf8');
 for(const content of ['{invalid',JSON.stringify({...JSON.parse(original),schemaVersion:99})]){await writeFile(file,content);await assert.rejects(library.get(profile),error=>error.status===409);assert.equal(await readFile(file,'utf8'),content);}
 const other=randomUUID(),old=path.join(root,'.sovereign','old-records');await mkdir(old);await symlink(old,path.join(root,'.sovereign','characters','v1',other),process.platform==='win32'?'junction':'dir');await assert.rejects(library.get(other),error=>error.status===409);
}));
