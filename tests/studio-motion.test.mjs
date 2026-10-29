import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {ACTIONS,validateCues} from '../shared/studio/actions.mjs';import {MOTION_BINDINGS,MOTION_ACTIONS,STAGE_ONLY_ACTIONS,motionDuration} from '../shared/studio/motion-library.mjs';import {performanceSample,performanceCatalogue,CORE_ACTIONS,validateCoreCues} from '../shared/studio/performance.mjs';import {facialReactionSample} from '../shared/studio/faces.mjs';import {AVATAR_MODELS} from '../shared/avatar-catalog.mjs';
const pack=JSON.parse(await readFile(new URL('../public/motions/rocketbox/body.json',import.meta.url),'utf8'));
test('every catalogued action is bound to an animation',()=>{assert.deepEqual([...MOTION_ACTIONS].sort(),ACTIONS.map(action=>action.id).sort());assert.equal(STAGE_ONLY_ACTIONS.length,15);for(const binding of Object.values(MOTION_BINDINGS)){assert.ok(binding.durationMs>=1600&&binding.durationMs<=(binding.mode==='stage'?18000:12000));if(binding.clip)assert.ok(pack.clips[binding.clip]);}assert.equal(MOTION_ACTIONS.length,155);for(const id of ['gesture.heart-hands','expression.wink','comedy.mic-drop','drama.sob','celebration.raise-the-roof'])assert.ok(MOTION_BINDINGS[id],id);});
test('pinned native motion assets have complete finite unit-vector tracks and recording-clock samples',()=>{assert.equal(pack.schemaVersion,1);assert.equal(pack.license,'MIT');assert.equal(Object.keys(pack.clips).length,36);for(const clip of Object.values(pack.clips)){assert.ok(clip.durationMs>0&&clip.durationMs<=12000);assert.equal(clip.directions.length,pack.bones.length*clip.frames*3);assert.equal(clip.palms.length,clip.frames*6);assert.equal(clip.hips.length,clip.frames*3);assert.equal(clip.across.length,clip.frames*3);for(const key of ['directions','palms','hips','across'])assert.ok(clip[key].every(Number.isFinite));for(let n=0;n<clip.directions.length;n+=3)assert.ok(Math.abs(Math.hypot(...clip.directions.slice(n,n+3))-1)<.00005);}});
test('all seven actual GLB rigs expose needed joints; missing props and loading motion remain explicit',async()=>{for(const model of AVATAR_MODELS){const bytes=await readFile(new URL('../public/avatars/rocketbox/'+model.id+'.glb',import.meta.url)),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const bones=gltf.nodes.filter(n=>n.name).map(n=>n.name.replace(/^Bip01[ _]/,'').replaceAll('_',' ')),morphs=gltf.meshes.flatMap(mesh=>mesh.extras?.targetNames||[]),props=['desk','chair','microphone','notes','pen','cup','laptop','watch','glasses'];const ready=performanceCatalogue('actor',{bones,morphs,verified:true,motionReady:true,props});assert.equal(ready.filter(action=>action.status==='ready').length,140,model.id);assert.equal(ready.find(a=>a.actionId==='social.handshake').status,'needs-staging');assert.equal(performanceCatalogue('actor',{bones,morphs,verified:true,motionReady:false,props}).find(a=>a.actionId==='comedy.laugh').status,'loading-motion');assert.equal(performanceCatalogue('actor',{bones,morphs,verified:true,motionReady:true,props:[]}).find(a=>a.actionId==='props.drink-water').status,'needs-prop');const short=performanceCatalogue('actor',{bones:bones.filter(b=>b!=='L Calf'),morphs,verified:true,motionReady:true,props});assert.equal(short.find(a=>a.actionId==='movement.jump').status,'unsupported-rig');assert.equal(short.find(a=>a.actionId==='movement.walk').status,'needs-staging');}});
test('action clocks preserve fade, elapsed source time and reduced motion without altering speech shapes',()=>{const cue={id:'a',characterId:'actor',actionId:'movement.jump',atMs:100,durationMs:motionDuration('movement.jump'),intensity:.8};const start=performanceSample([cue],100,{characterId:'actor'})[0],normal=performanceSample([cue],1300,{characterId:'actor'})[0],reduced=performanceSample([cue],1300,{characterId:'actor',reducedMotion:true})[0];assert.equal(start.envelope,0);assert.equal(normal.elapsedMs,1200);assert.equal(normal.progress,reduced.progress);assert.equal(normal.durationMs,reduced.durationMs);assert.ok(reduced.intensity<normal.intensity);assert.deepEqual(performanceSample([cue],100+cue.durationMs,{characterId:'actor'}),[]);for(const actionId of ['fatigue.yawn','expression.jaw-drop','comedy.belly-laugh'])assert.equal(facialReactionSample([{actionId,intensity:.8,progress:.5}],{speaking:true}).AK_25_JawOpen,undefined);const frown=facialReactionSample([{actionId:'expression.frown',intensity:.8,progress:.5}]);assert.ok(frown.AK_44_MouthSmileLeft<0&&frown.AK_44_MouthSmileLeft>=-.35);});
test('stage routes start and end in a chair, keep partners on one clock and stay inside the set',async()=>{
  const {STAGE_KINDS,PARTNER_ACTIONS,stagePlan,stageSample,LANE_Z,STAGE_EDGE}=await import('../shared/studio/stage-paths.mjs');
  const oneWay=['movement.exit','debate.walk-out','drama.storm-off'],arriving=['movement.enter','drama.return-sheepishly'];
  for(const id of Object.keys(STAGE_KINDS)){assert.equal(MOTION_BINDINGS[id].mode,'stage',id);for(const worldX of [-1.575,-.525,.525,1.575])for(const dx of [-3.15,-1.05,1.05,2.1]){
    const plan=stagePlan(id,{dx,worldX}),start=stageSample(plan,0),end=stageSample(plan,1);
    if(!arriving.includes(id))assert.deepEqual([start.x,start.z,start.stand],[0,0,0],id);
    if(oneWay.includes(id))assert.ok(Math.abs(worldX+end.x)>=STAGE_EDGE-.01&&end.z===LANE_Z,id);else assert.equal(end.stand,0,id);
    if(id==='movement.change-seat')assert.ok(Math.abs(end.x-dx)<1e-9,id);else if(!oneWay.includes(id))assert.ok(Math.abs(end.x)<1e-9&&Math.abs(end.z)<1e-9,id);
    for(let n=0;n<=100;n++){const s=stageSample(plan,n/100);assert.ok(s.z>=LANE_Z-1e-9&&s.z<=.01&&Number.isFinite(s.yaw)&&s.walk>=0&&s.walk<=1,id);}
  }}
  for(const id of PARTNER_ACTIONS){const lead=stagePlan(id,{dx:2.1}),partner=stagePlan(id,{dx:-2.1,role:'partner'});assert.equal(lead.durationMs,partner.durationMs,id);assert.equal(lead.marks.meet,partner.marks.meet,id);assert.ok(Math.abs(lead.meet.x+partner.meet.x-0)<1e-9);}
  const a=stagePlan('movement.change-seat',{dx:1.05,swap:true}),b=stagePlan('movement.change-seat',{dx:-1.05,swap:true,role:'partner'});assert.equal(a.durationMs,b.durationMs);
});
test('new expressions use the shipped face shapes and leave speech lips alone',()=>{
  const wink=facialReactionSample([{actionId:'expression.wink',intensity:.8,progress:.5}]);assert.ok(wink.AK_09_EyeBlinkLeft>.9&&wink.AK_10_EyeBlinkRight<.2);
  assert.ok(facialReactionSample([{actionId:'expression.pout',intensity:.8,progress:.5}]).AA_VI_14_U>.3);assert.equal(facialReactionSample([{actionId:'expression.pout',intensity:.8,progress:.5}],{speaking:true}).AA_VI_14_U,undefined);
  const shapes=new Set(['AA_VI_01_PP','AA_VI_06_CH','AA_VI_07_SS','AA_VI_11_E','AA_VI_13_O','AA_VI_14_U','AK_03_BrowInnerUp','AK_04_BrowOuterUpLeft','AK_05_BrowOuterUpRight','AK_09_EyeBlinkLeft','AK_10_EyeBlinkRight','AK_25_JawOpen','AK_44_MouthSmileLeft','AK_45_MouthSmileRight']);
  for(const action of ACTIONS)for(const name of Object.keys(facialReactionSample([{actionId:action.id,intensity:1,progress:.5}])))assert.ok(shapes.has(name),action.id+' '+name);
});

test('partner meetings reserve the travelling actors locomotion lane',()=>{
  for(const actionId of ['social.handshake','social.high-five','props.hand-over-note']){
    const cue={id:'meet',characterId:'actor',targetId:'partner',actionId,atMs:0,durationMs:14000,intensity:.8};
    assert.throws(()=>validateCues([cue,{...cue,id:'jump',actionId:'movement.jump',atMs:1000,durationMs:4400}],{characterIds:['actor','partner']}),/Conflicting performance lanes/);
  }
});

test('unfinished stage actions are gated from readiness, generation, validation and saved playback',async()=>{
  const {STAGE_KINDS}=await import('../shared/studio/stage-paths.mjs');
  const bytes=await readFile(new URL('../public/avatars/rocketbox/'+AVATAR_MODELS[0].id+'.glb',import.meta.url)),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const bones=gltf.nodes.filter(n=>n.name).map(n=>n.name.replace(/^Bip01[ _]/,'').replaceAll('_',' ')),morphs=gltf.meshes.flatMap(mesh=>mesh.extras?.targetNames||[]);
  const catalogue=performanceCatalogue('actor',{bones,morphs,verified:true,motionReady:false,props:['notes','chair']});
  for(const actionId of Object.keys(STAGE_KINDS)){assert.equal(catalogue.find(a=>a.actionId===actionId).status,'needs-staging',actionId);assert.ok(!CORE_ACTIONS.includes(actionId),actionId);const cue={id:'blocked',characterId:'actor',targetId:'partner',actionId,atMs:0,durationMs:16000,intensity:.8};assert.deepEqual(performanceSample([cue],5000,{characterId:'actor'}),[],actionId);assert.throws(()=>validateCoreCues([cue],{characterIds:['actor','partner']}),/animation is not ready/,actionId);}assert.equal(CORE_ACTIONS.length,140);
});

test('every facial cue respects zero intensity and reduced motion, with speech lips authoritative',()=>{
  for(const {id:actionId} of ACTIONS){
    const action={actionId,intensity:0,progress:.5,envelope:1};
    assert.ok(Object.values(facialReactionSample([action])).every(value=>value===0),actionId+' zero intensity');
    const full=facialReactionSample([{...action,intensity:.8}]),reduced=facialReactionSample([{...action,intensity:.28}]);
    for(const name of Object.keys(full))assert.ok(Math.abs(reduced[name]||0)<=Math.abs(full[name])+.000001,actionId+' '+name);
    const speaking=facialReactionSample([{...action,intensity:1}],{speaking:true});
    assert.ok(Object.keys(speaking).every(name=>!name.startsWith('AA_VI')&&name!=='AK_25_JawOpen'),actionId+' speech owns lips');
  }
});

// Load the actual TypeScript motion engine in Node, preserving its runtime
// imports. A minimal rig lets us observe authored contact weights without GPU
// startup or copying the implementation into a test double.
async function contactRig(){
  const [{transpileModule,ModuleKind,ScriptTarget},THREE]=await Promise.all([import('typescript'),import('three')]);
  const sourceURL=new URL('../src/studio-motion.ts',import.meta.url),source=await readFile(sourceURL,'utf8');
  const js=transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText.replace(/from '([^']+)'/g,(_,specifier)=>`from '${specifier.startsWith('.')?new URL(specifier,sourceURL).href:import.meta.resolve(specifier)}'`);
  const {StudioMotionRig}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  return new StudioMotionRig({group:new THREE.Group(),bone:()=>undefined,aim:()=>{},twist:()=>{},turn:()=>{}});
}

test('authored hand contacts scale with cue intensity and reduced motion in the runtime engine',async()=>{
  const rig=await contactRig(),calls=[];rig.place=(...args)=>calls.push(args);
  try{for(const {id:actionId} of ACTIONS.filter(action=>action.family==='gesture'||['comedy.slow-clap','celebration.raise-the-roof','drama.hands-on-head','drama.sob'].includes(action.id))){
    // Slow clap uses wrist IK directly, so observe that entry point as well.
    rig.hand=(...args)=>calls.push([args[0],args[1],null,null,null,args[2]??1]);
    const sample=intensity=>{calls.length=0;rig.apply([{actionId,intensity,progress:.52,envelope:1,durationMs:motionDuration(actionId)}],.5,true,0,0);return calls.map(call=>call[5]);};
    // apply() first settles both hands; only subsequent calls belong to the cue.
    const full=sample(.8).slice(2),reduced=sample(.28).slice(2),zero=sample(0).slice(2);
    assert.ok(full.length,actionId);assert.equal(zero.length,0,actionId+' zero intensity');assert.equal(full.length,reduced.length,actionId);
    for(let i=0;i<full.length;i++)assert.ok(Math.abs(reduced[i]-full[i]*.35)<.000001,actionId+' contact strength');
  }}finally{rig.dispose();}
});

test('short chair sidesteps ease the walk cycle over time instead of snapping it on',async()=>{
  const {stagePlan,stageSample}=await import('../shared/studio/stage-paths.mjs');
  const plan=stagePlan('movement.walk');let previous=stageSample(plan,0);
  for(let t=1000;t<=1400;t+=1000/30){const next=stageSample(plan,t/plan.durationMs);assert.ok(Math.abs(next.walk-previous.walk)<.15,'gait blend at '+t);previous=next;}
});
