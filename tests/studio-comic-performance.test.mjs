import {normaliseWriterScene,validateWriterScene,writerSceneBudget,writerSchema} from '../server/studio-writer.mjs';
import {captionSrt} from '../shared/studio/edition.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {deliveryPause,deliveryClock,deliveryAudience,validateDelivery} from '../shared/studio/delivery.mjs';
import {performanceTimelineCues,writtenPerformanceCues,resolvedPerformanceCues} from '../shared/studio/written-performance.mjs';
import {performanceSample} from '../shared/studio/performance.mjs';
import {vocalReactionEvents} from '../shared/studio/vocal-reactions.mjs';
import {stagedDelivery} from '../server/studio-delivery.mjs';import {sparseStaging,validateStaging} from '../server/studio-staging.mjs';
const reaction={characterId:'listener',actionId:'comedy.chuckle',intensity:.4,vocal:'chuckle',voicePack:'female-1'},delivery={schemaVersion:1,pauseMs:1800,audience:'none',reaction};
test('a punchline reaction starts in its pause, never over a subsequent answer, and survives edited timing',()=>{
 const p={runId:'run',writer:{atTurn:0,lines:[],staging:{performanceVersion:2,lines:[]}},turns:[{id:'a',beatId:'a',runId:'run',characterId:'speaker',startMs:0,durationMs:2000,text:'A setup.',delivery},{id:'b',beatId:'b',runId:'run',characterId:'listener',startMs:2000,durationMs:1000,text:'A reply.',delivery:{schemaVersion:1,pauseMs:180,audience:'none'}}],cues:[]},before=structuredClone(p),cues=performanceTimelineCues(p);
 assert.equal(performanceSample(cues,1900,{characterId:'listener'}).length,0);assert.equal(performanceSample(cues,2600,{characterId:'listener'}).length,1);assert.equal(performanceSample(cues,3800,{characterId:'listener'}).length,0);
 const events=vocalReactionEvents(p.turns);assert.equal(events[0].startMs,2120);assert.equal(deliveryClock(p.turns[1],0,{turns:p.turns}).programmeTimeMs,3800);assert.ok(events[0].startMs+events[0].durationMs<3800);
 const edited=[{...p.turns[0],startMs:1000,durationMs:1500,trimStartMs:500,pauseAfterMs:1800}];assert.equal(performanceTimelineCues(p,edited)[0].atMs,2620);assert.equal(vocalReactionEvents(edited)[0].startMs,2620);assert.deepEqual(p,before);const subtitle=captionSrt({productionSnapshot:{...p,turns:p.turns.map(turn=>({...turn,characterSnapshot:{name:turn.characterId}}))},castSnapshots:[]});assert.match(subtitle,/00:00:03,800 --> /);
});
test('director timing is bounded, genuine silence is allowed, and accepted legacy delivery stays identical',()=>{
 const actors=[{id:'listener',avatar:{seed:1},studioProfile:{behaviour:{energy:.15}}}],line={characterId:'speaker',text:'The counter has charged a queue fee.',intent:'payoff'},stage={pauseMs:1700,audience:'none',reactionCharacterId:'listener',reactionActionId:'comedy.chuckle',reactionTiming:'after',intensity:.6,vocal:'chuckle'};
 const d=stagedDelivery(line,stage,actors);assert.equal(deliveryAudience({...line,delivery:d}),false);assert.ok(d.reaction.intensity<.6);assert.doesNotThrow(()=>validateDelivery(d,['speaker','listener']));assert.equal(deliveryPause({...line,delivery:d}),1700);
 assert.equal(deliveryPause(line),1900);assert.equal(deliveryAudience(line),true);assert.equal(deliveryPause({...line,intent:'closing',delivery:d}),5200);assert.equal(deliveryPause({...line,delivery:d},{enabled:false}),0);
 for(const bad of [{...d,pauseMs:Infinity},{...d,pauseMs:50000},{...d,reaction:{...d.reaction,characterId:'stranger'}},{...d,reaction:{...d.reaction,voicePack:'../../secret'}},{...d,audience:'light'}])assert.throws(()=>validateDelivery(bad,['speaker','listener']));
});
test('quiet lines separate reactions and a payoff label does not compel laughter',()=>{
 const lines=Array.from({length:12},(_,i)=>({characterId:'speaker',intent:i===11?'closing':i%4===2?'payoff':'statement'})),plan={lines:lines.map((line,i)=>({lineIndex:i,shot:'reaction',reactionCharacterId:'listener',reactionActionId:'comedy.chuckle',atFraction:.8,intensity:.4,pauseMs:1700,reactionTiming:'after',audience:'light',vocal:'chuckle'}))};
 const p=sparseStaging(plan,lines),active=p.lines.filter(line=>line.reactionCharacterId);assert.ok(active.length<=4);assert.ok(p.lines.filter(line=>line.vocal==='chuckle').length<=3);assert.ok(p.lines.filter(line=>line.audience==='light').length<=2);assert.ok(!p.lines.some(line=>line.audience==='light'&&line.vocal==='chuckle'));assert.equal(p.lines[11].reactionCharacterId,null);assert.equal(p.lines[11].shot,'host');assert.ok(p.lines.some(line=>line.vocal==='none'&&line.audience==='none'));
 assert.throws(()=>validateStaging({lines:[{...plan.lines[0],pauseMs:9999}]},{cast:[{characterId:'speaker'},{characterId:'listener'}],lines}));
});
test('the new plan cannot resurrect discarded gestures, while legacy directed actions stay intact',()=>{
 const line={characterId:'speaker',intent:'statement',cues:[{characterId:'speaker',actionId:'speaking.open-palms',intensity:.6}]},lines=[line,line,line];assert.equal(writtenPerformanceCues(line,null,{sparse:true,lines,lineIndex:1}).length,0);assert.equal(writtenPerformanceCues(line,null).length,1);
 const p={runId:'run',turns:[{id:'turn',beatId:'beat',runId:'run',characterId:'speaker',startMs:0,durationMs:5000}],cues:[],writer:{atTurn:0,lines:[line],staging:{performanceVersion:2,lines:[]}}};assert.deepEqual(resolvedPerformanceCues(p),[]);delete p.writer.staging.performanceVersion;assert.equal(resolvedPerformanceCues(p).length,1);
});
test('every optional vocal clip has pinned CC0 provenance and immutable asset bytes',async()=>{
 const manifest=JSON.parse(await readFile('public/audio/reactions/SOURCES.json','utf8'));assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.files.length,16);for(const file of manifest.files){const bytes=await readFile('public/audio/reactions/'+file.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.ok(file.durationMs>=150&&file.durationMs<=1150);}
});

test('a listener hold cannot delay the answer to a direct question',()=>{
 const actor={id:'listener',avatar:{seed:1},studioProfile:{behaviour:{energy:.5}}},line={characterId:'speaker',text:'What did the shopkeeper actually charge?',intent:'question'},stage={pauseMs:2200,audience:'none',reactionCharacterId:'listener',reactionActionId:'comedy.chuckle',reactionTiming:'after',intensity:.5,vocal:'chuckle'};const delivery=stagedDelivery(line,stage,[actor]);assert.ok(delivery.pauseMs<=300);assert.equal(delivery.reaction,undefined);
});

test('a four-person show gives the host a self-introduction and each panel member an individual host-spoken segment',()=>{
 const ids=['host','one','two','three'],cast=ids.map((characterId,i)=>({characterId,slotId:i===0?'host':'guest'+i})),body=ids.slice(1).concat(['one','host']).map((characterId,i)=>({characterId,text:'A distinct contribution '+i,intent:i===4?'closing':i===3?'payoff':'statement',targetId:null,introducedCharacterIds:[],cues:[]})),source={summary:'A host and panel introduction.',detourUsed:false,introductions:ids.map(characterId=>({characterId,text:characterId==='host'?'मैं विनय हूँ।':'हमारे साथ हैं '+characterId+'।'})),lines:body},before=structuredClone(source),scene=normaliseWriterScene(source,{cast,initial:true,hostId:'host'});
 assert.doesNotThrow(()=>validateWriterScene(scene,{cast,firstSpeakerId:'host',hostId:'host',maxLines:12,requireClosing:true}));assert.deepEqual(scene.lines.slice(0,4).map(line=>line.introducedCharacterIds[0]),ids);assert.ok(scene.lines.slice(0,4).every(line=>line.characterId==='host'));assert.deepEqual(scene.lines.slice(4),body);assert.deepEqual(source,before);
 assert.throws(()=>validateWriterScene({...scene,introductions:scene.introductions.slice(1)},{cast,firstSpeakerId:'host',hostId:'host',maxLines:12}),/host himself first/);
});

test('four introductions never consume dialogue room, and a complete four-person scene can exceed the former total cap',()=>{
 const cast=['host','one','two','three'].map((characterId,index)=>({characterId,slotId:index?'guest-'+index:'host'})),budget=writerSceneBudget({cast,initial:true,maxDialogueLines:32}),schema=writerSchema(cast,budget),body=Array.from({length:15},(_,i)=>({characterId:i===14?'host':cast[i%4].characterId,text:'A genuinely different spoken contribution number '+i,intent:i===14?'closing':i===13?'payoff':'statement',targetId:null,introducedCharacterIds:[],cues:[]})),source={summary:'Four introductions, complete dialogue and a separate ending.',detourUsed:false,introductions:cast.map(member=>({characterId:member.characterId,text:'Introducing '+member.characterId})),lines:body},scene=normaliseWriterScene(source,{cast,initial:true,hostId:'host'});
 assert.equal(budget.maxLines,36);assert.equal(schema.properties.lines.maxItems,32);assert.equal(schema.properties.introductions.minItems,4);assert.equal(scene.lines.length,19);assert.doesNotThrow(()=>validateWriterScene(scene,{cast,firstSpeakerId:'host',hostId:'host',requireClosing:true,...budget}));assert.deepEqual(scene.lines.slice(4),body);
 const continuation=writerSceneBudget({cast,initial:false,maxDialogueLines:32});assert.equal(continuation.maxLines,32);assert.equal(writerSchema(cast,continuation).properties.introductions.maxItems,0);
 assert.throws(()=>validateWriterScene(scene,{cast,firstSpeakerId:'host',hostId:'host',minLines:8,maxLines:12}),/19 spoken contributions \(4 introductions and 15 dialogue lines\)/);
});
test('metadata repair follows an actual answer to a general question without redirecting an explicitly named question',()=>{
 const cast=['speaker','meera','brijesh'].map(characterId=>({characterId})),characters=[{id:'speaker',name:'Vinay'},{id:'meera',name:'Meera'},{id:'brijesh',name:'Brijesh'}],question={characterId:'speaker',text:'Who can confirm the bill?',intent:'question',targetId:'brijesh'},answer={characterId:'meera',text:'I have the original receipt.',intent:'answer'},scene={lines:[question,answer]};
 const repaired=normaliseWriterScene(scene,{cast,characters});assert.equal(repaired.lines[0].targetId,'meera');assert.equal(repaired.lines[0].text,question.text);assert.equal(repaired.lines[1],answer);assert.equal(scene.lines[0].targetId,'brijesh');const named=normaliseWriterScene({lines:[{...question,text:'Brijesh, who can confirm the bill?'},answer]},{cast,characters});assert.equal(named.lines[0].targetId,'brijesh');
});

test('the self-introduction uses the actual host name once even if the model supplies only a hook',()=>{
 const cast=[{characterId:'host',slotId:'host'},{characterId:'panel'}],characters=[{id:'host',name:'रघु'},{id:'panel',name:'निशा'}],source={introductions:[{characterId:'host',text:'आज मोहल्ले की चाय पर बवाल है।'},{characterId:'panel',text:'हमारे साथ निशा हैं।'}],lines:[]},once=normaliseWriterScene(source,{cast,characters,initial:true,hostId:'host'});assert.match(once.lines[0].text,/मैं रघु हूँ।/);const twice=normaliseWriterScene({...once,lines:[]},{cast,characters,initial:true,hostId:'host'});assert.equal(twice.lines[0].text,once.lines[0].text);assert.equal((once.lines[0].text.match(/रघु/g)||[]).length,1);assert.equal(source.introductions[0].text,'आज मोहल्ले की चाय पर बवाल है।');
});

test('individual introductions do not consume the host conversational repetition allowance',()=>{
 const ids=['host','one','two'],cast=ids.map(characterId=>({characterId})),line=(characterId,text,intent,targetId=null)=>({characterId,text,intent,targetId,introducedCharacterIds:[],cues:[]}),source={summary:'An introduction and natural hand-off.',detourUsed:false,introductions:ids.map(characterId=>({characterId,text:'Introducing '+characterId})),lines:[line('host','Where is the receipt?','question','one'),line('one','I left it by the kettle.','answer'),line('two','Then the kettle is the only witness.','payoff'),line('host','That ends our bulletin.','closing')]},scene=normaliseWriterScene(source,{cast,initial:true,hostId:'host'});
 assert.doesNotThrow(()=>validateWriterScene(scene,{cast,firstSpeakerId:'host',hostId:'host',maxLines:12,requireClosing:true}));
});

test('a silent eyebrow has a readable hold while vocal and physical responses have room to finish',()=>{
 const actor={id:'listener',avatar:{seed:1},studioProfile:{behaviour:{energy:.5}}},line={characterId:'speaker',text:'A short literal observation.',intent:'statement'},stage={pauseMs:500,audience:'none',reactionCharacterId:'listener',reactionActionId:'response.raise-eyebrow',reactionTiming:'after',intensity:.4,vocal:'none'},brief=stagedDelivery(line,stage,[actor]);assert.equal(brief.pauseMs,900);assert.doesNotThrow(()=>validateDelivery(brief,['speaker','listener']));const physical=stagedDelivery(line,{...stage,reactionActionId:'response.concede-point'},[actor]);assert.ok(physical.reaction);assert.equal(physical.pauseMs,1200);const vocal=stagedDelivery(line,{...stage,reactionActionId:'comedy.chuckle',vocal:'chuckle'},[actor]);assert.equal(vocal.pauseMs,1600);
 const p={runId:'run',writer:{},cues:[],turns:[{id:'short',beatId:'short',runId:'run',characterId:'speaker',startMs:0,durationMs:1000,delivery:brief}]},cues=performanceTimelineCues(p);assert.equal(performanceSample(cues,1250,{characterId:'listener'}).length,1);assert.equal(performanceSample(cues,1900,{characterId:'listener'}).length,0);
});
