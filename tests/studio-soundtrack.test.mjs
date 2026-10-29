import test from 'node:test';import assert from 'node:assert/strict';import {soundtrackGain,soundtrackGainAt,MUSIC_LEVELS} from '../shared/studio/soundtrack.mjs';
test('the soundtrack has a strong intro/outro, a quieter speech bed and a smooth final fade',()=>{
 const intro=soundtrackGain({programmeTimeMs:2000}),bed=soundtrackGain({programmeTimeMs:12000}),outro=soundtrackGain({programmeTimeMs:20000,outro:true,outroProgress:.1});assert.ok(intro>bed*2.5);assert.ok(outro>bed*2.5);assert.ok(soundtrackGain({programmeTimeMs:12000,audience:true})<bed);assert.equal(soundtrackGain({programmeTimeMs:0}),0);assert.equal(soundtrackGain({programmeTimeMs:23000,outro:true,outroProgress:1}),0);
 for(let p=0;p<=1;p+=.01){const gain=soundtrackGain({programmeTimeMs:20000,outro:true,outroProgress:p});assert.ok(gain>=0&&gain<=MUSIC_LEVELS.intro);}
});
test('offline music uses the same programme clock and closing pause as playback',()=>{
 const lines=[{startMs:0,durationMs:12000,pauseAfterMs:380},{startMs:12380,durationMs:1000,pauseAfterMs:5200,intent:'closing'}];assert.equal(soundtrackGainAt(2000,lines),soundtrackGain({programmeTimeMs:2000}));assert.equal(soundtrackGainAt(13000,lines),MUSIC_LEVELS.bed);assert.ok(soundtrackGainAt(14000,lines)>MUSIC_LEVELS.bed*2);assert.equal(soundtrackGainAt(18580,lines),0);assert.equal(soundtrackGainAt(-1,lines),0);
});
