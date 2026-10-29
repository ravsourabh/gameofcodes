import test from 'node:test';import assert from 'node:assert/strict';
import {writtenPerformanceCues,resolvedPerformanceCues} from '../shared/studio/written-performance.mjs';
import {motionWindow,motionDuration} from '../shared/studio/motion-library.mjs';
import {timeGeneratedCues} from '../server/studio-production.mjs';
import {createHash} from 'node:crypto';
const line={characterId:'speaker',intent:'statement',cues:[{characterId:'speaker',actionId:'speaking.open-palms',intensity:.7}]};
const stage={lineIndex:0,reactionCharacterId:'listener',reactionActionId:'expression.grin',intensity:.5};
test('listener staging retains writer-directed speaker motion and a quiet closing',()=>{
  assert.deepEqual(writtenPerformanceCues(line,stage).map(c=>c.actionId),['expression.grin','speaking.open-palms']);
  assert.equal(writtenPerformanceCues(line,{...stage,reactionCharacterId:null}).length,1);
  assert.deepEqual(writtenPerformanceCues({...line,intent:'closing'},stage),[]);
  assert.equal(writtenPerformanceCues({...line,cues:[{...line.cues[0],actionId:'props.drink-water'}]},null).length,0);
});
test('discarded legacy speaker directions recover without writes or overriding an explicit motion',()=>{
 const p={runId:'run',turns:[{id:'turn',runId:'run',characterId:'speaker',startMs:0,durationMs:7000}],cues:[],writer:{atTurn:0,lines:[line],staging:{lines:[stage]}}},before=structuredClone(p);
 const cues=resolvedPerformanceCues(p);assert.equal(cues.length,1);assert.equal(cues[0].actionId,'speaking.open-palms');assert.equal(cues[0].durationMs,motionDuration('speaking.open-palms'));assert.deepEqual(p,before);
 p.cues=[{id:'manual',triggerTurnId:'turn',runId:'run',characterId:'speaker',actionId:'debate.fold-arms',atMs:500,durationMs:3000,intensity:.6}];assert.deepEqual(resolvedPerformanceCues(p),p.cues);
});
test('native source windows select active motion while keeping playback speed bounded',()=>{
 const clip={durationMs:12000,frames:13,directions:Array.from({length:13},(_,i)=>i<7?[0,1,0]:i%2?[1,0,0]:[0,1,0]).flat()};
 const window=motionWindow(clip,['R UpperArm'],3000);assert.ok(window.startMs>=4000);assert.equal(window.speed,1);assert.equal(motionWindow(clip,['R UpperArm'],24000).speed,.5);
});
test('audio timing preserves a complete speaker gesture instead of a 1.1-second fragment',()=>{
 const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b=createHash('sha256').update(requestId+'/cue/0').digest().subarray(0,16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=b.toString('hex'),id=`${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
 const cue={id,triggerTurnId:'turn',characterId:'speaker',actionId:'speaking.open-palms',atMs:0,durationMs:1000};timeGeneratedCues([cue],{id:'turn',requestId,startMs:0},8000);assert.equal(cue.durationMs,motionDuration(cue.actionId));assert.equal(cue.atMs,550);
});
