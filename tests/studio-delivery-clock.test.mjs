import test from 'node:test';import assert from 'node:assert/strict';
import {deliveryClock,deliveryPause} from '../shared/studio/delivery.mjs';

test('a speaker handoff preserves body time while audio cues stay inside their recording',()=>{
 const turns=[{id:'one',startMs:0,durationMs:6000,text:'पहली बात।'},{id:'two',startMs:6000,durationMs:6000,text:'अगली बात।'}];
 const end=deliveryClock(turns[0],6380,{turns}),waiting=deliveryClock(turns[0],7200,{turns}),next=deliveryClock(turns[1],0,{turns});
 assert.equal(end.sourceTimeMs,6000);assert.equal(end.programmeTimeMs,6380);assert.deepEqual(waiting,end);assert.equal(next.programmeTimeMs,end.programmeTimeMs);assert.equal(next.sourceTimeMs,6000);
});
test('laugh and closing pauses are retained once in the continuous programme clock',()=>{
 const turns=[{id:'one',startMs:0,durationMs:1000,intent:'payoff'},{id:'two',startMs:1000,durationMs:1000,intent:'closing'}];
 const handoff=deliveryClock(turns[1],0,{turns});assert.equal(handoff.programmeTimeMs,2900);
 const end=deliveryClock(turns[1],10000,{turns});assert.equal(end.programmeTimeMs,9100);assert.equal(end.sourceTimeMs,2000);assert.equal(end.localMs,1000+deliveryPause(turns[1]));
});
test('caption-only playback without writer pauses uses the same source duration fallback',()=>{
 const turns=[{id:'one',startMs:0,text:'One.'},{id:'two',startMs:1200,text:'Two.'}];
 assert.deepEqual(deliveryClock(turns[1],200,{turns,enabled:false}),{sourceTimeMs:1400,programmeTimeMs:1400,localMs:200});
});
