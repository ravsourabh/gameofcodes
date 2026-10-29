import test from 'node:test';import assert from 'node:assert/strict';
import {editStudioScene,resolveStudioReviewer} from '../server/studio-editor.mjs';
import {sameReviewModel,validateSceneReview} from '../shared/studio/editorial.mjs';
import {writerSceneBudget,normaliseWriterScene,validateWriterScene} from '../server/studio-writer.mjs';
import {sceneCraftSchema,validateSceneCraft} from '../shared/studio/scene-craft.mjs';
const writerBrain={provider:'openai',model:'gpt-6-astra'},reviewerBrain={provider:'anthropic',model:'claude-opus-5-5'},cast=['host','one','two'].map(characterId=>({characterId})),budget=writerSceneBudget({cast,initial:true,maxDialogueLines:32});
const input={atTurn:0,runId:'run',hostId:'host',firstSpeakerId:'host',writerNotes:'Quiet sincere answers may set up the joke.',adultComedy:false,language:{primary:'hi-IN'},cast,characters:cast.map((p,i)=>({id:p.characterId,name:['विनय','मीरा','बृजेश'][i],personality:['Lazy host','Quiet sceptic','Confident literalist'][i]})),history:[]};
const rawScene=()=>({summary:'The witness rule costs the shopkeeper his own tea.',detourUsed:false,introductions:cast.map(p=>({characterId:p.characterId,text:'आज साथ हैं '+p.characterId+'।'})),lines:['one','two','one','host'].map((characterId,i)=>({characterId,text:['A sincere answer about the tea.','An explanatory sentence that should be tightened.','The tea has become the witness.','That closes our bulletin.'][i],intent:i===3?'closing':i===2?'payoff':'statement',targetId:null,introducedCharacterIds:[],cues:[]}))});
const review=(revise=false)=>({balanced:true,fresh:true,coherent:true,responsive:true,earnedEnding:true,inCharacter:true,verdict:revise?'revise':'approve',reason:revise?'Line 5 explains the joke instead of advancing it.':'The revision leaves the sincere answer and earned tea payoff intact.',issues:revise?[{lineNumbers:[5],category:'overexplaining',severity:'required',problem:'The middle explains an established joke.',instruction:'Replace the explanation with a concrete consequence; keep the quiet answer and tea payoff.'}]:[],preserveLines:[4,6]});
const options=ai=>({ai,profileId:'profile',writerBrain,reviewerBrain,input,budget,cast,initial:true,hostId:'host'});
const craft=()=>({schemaVersion:1,situation:'A shopkeeper wants to reclaim his tea.',comicRule:'A witness is required even for his own cup.',objectives:[{characterId:'one',want:'Get the cup back.',selfImage:'Practical.',pressure:'His own rule blocks him.'}],relationships:[{characterId:'one',otherId:'two',basis:'episode',tension:'The customer insists on his rule.'}],alternatives:[{discovery:'His cup has no receipt.',consequence:'He needs the customer.',payoff:'The customer keeps the tea.'},{discovery:'The kettle saw everything.',consequence:'The witness is still boiling.',payoff:'The shopkeeper must wait.'}],chosenAlternative:1,detourOpportunity:'Follow his admission about the missing receipt.',ending:'His rule leaves him waiting.'});
test('scene construction rejects invented actors and persists alternatives through editorial recovery',async()=>{
 assert.equal(sceneCraftSchema(['one','two']).properties.alternatives.minItems,2);assert.doesNotThrow(()=>validateSceneCraft(craft(),['host','one','two']));
 assert.throws(()=>validateSceneCraft({...craft(),chosenAlternative:2},['host','one','two']),/select one/);
 assert.throws(()=>validateSceneCraft({...craft(),objectives:[{...craft().objectives[0],characterId:'invented'}]},['host','one','two']),/actual character/);
 let saved,available=false,writes=0;const ai={writeStudio:async(_p,brain)=>{writes++;return {brain,text:JSON.stringify({...rawScene(),sceneCraft:craft()})};},reviewStudio:async(_p,brain,request)=>{assert.deepEqual(request.proposedScene.sceneCraft,craft());if(!available)throw Error('Temporary review failure');return {brain,text:JSON.stringify(review())};}};
 await assert.rejects(editStudioScene({...options(ai),onCheckpoint:j=>saved=j}),/Temporary/);assert.deepEqual(saved.attempts[0].draft.sceneCraft,craft());available=true;
 const result=await editStudioScene({...options(ai),previous:saved});assert.equal(writes,1);assert.deepEqual(result.scene.sceneCraft,craft());
});
test('answer-driven scene detours choose their own timing and participants without changing legacy rules',()=>{
 const scene=normaliseWriterScene({...rawScene(),sceneCraft:craft(),detourUsed:true},{cast,initial:true,hostId:'host'}),banter={startIndex:3,initiatorId:'two',targetId:'one'};
 assert.doesNotThrow(()=>validateWriterScene(scene,{cast,initial:true,firstSpeakerId:'host',hostId:'host',requireClosing:true,banter,...budget}));
 const legacy={...scene};delete legacy.sceneCraft;assert.throws(()=>validateWriterScene(legacy,{cast,initial:true,firstSpeakerId:'host',hostId:'host',requireClosing:true,banter,...budget}),/personal question/);
});
test('automatic reviewer prefers another provider and never falls back to the writer',async()=>{
 const ai={catalog:async()=>({providers:[{id:'openai',models:[{id:'gpt-6-astra'}]},{id:'anthropic',models:[{id:'claude-opus-5-5'}]}]}),validateAssignment:async()=>{}};
 assert.deepEqual(await resolveStudioReviewer(ai,writerBrain,null),reviewerBrain);assert.ok(sameReviewModel(writerBrain,{provider:'openai',model:'gpt-6-astra-2026-10-01'}));await assert.rejects(resolveStudioReviewer(ai,writerBrain,writerBrain),error=>error.code==='REVIEWER_CONFLICT');
 ai.catalog=async()=>({providers:[{id:'openai',models:[{id:'gpt-6-astra'}]}]});await assert.rejects(resolveStudioReviewer(ai,writerBrain,null),error=>error.code==='REVIEWER_UNAVAILABLE');
});
test('a coherent but weak scene is revised and re-reviewed without flattening characters or dropping strong lines',async()=>{
 let writes=0,reviews=0,checkpoint;const original=structuredClone(input),ai={writeStudio:async(_p,brain,request)=>{writes++;const scene=rawScene();if(writes>1){assert.equal(request.editorialFeedback.issues[0].category,'overexplaining');assert.equal(request.revisionDraft.lines.length,4);scene.lines[1].text='The shopkeeper now needs his customer as a witness.';}return {brain,text:JSON.stringify(scene)};},reviewStudio:async(_p,brain,request)=>{reviews++;assert.deepEqual(brain,reviewerBrain);if(reviews>1)assert.equal(request.previousReview.verdict,'revise');return {brain,text:JSON.stringify(review(reviews===1))};}};
 const result=await editStudioScene({...options(ai),onCheckpoint:j=>checkpoint=j});assert.equal(writes,2);assert.equal(reviews,2);assert.equal(result.scene.lines[3].text,rawScene().lines[0].text);assert.equal(result.scene.lines.at(-2).text,rawScene().lines[2].text);assert.equal(checkpoint.status,'approved');assert.equal(checkpoint.attempts.length,2);assert.deepEqual(input,original);
});
test('a failed reviewer resumes the saved draft instead of charging for another writer call',async()=>{
 let writes=0,available=false,saved;const ai={writeStudio:async(_p,brain)=>{writes++;return {brain,text:JSON.stringify(rawScene())};},reviewStudio:async(_p,brain)=>{if(!available)throw Error('Reviewer network failure');return {brain,text:JSON.stringify(review())};}};
 await assert.rejects(editStudioScene({...options(ai),onCheckpoint:j=>saved=j}),/network failure/);assert.equal(saved.status,'reviewing');assert.ok(saved.attempts[0].draft);available=true;const result=await editStudioScene({...options(ai),previous:saved});assert.equal(writes,1);assert.equal(result.journal.status,'approved');
});

test('an explicit writer change continues a blocked revision with its draft, feedback and actual model history intact',async()=>{
 const gemini={provider:'gemini',model:'gemini-4-argon'},writes=[];let saved,reviews=0;
 const ai={writeStudio:async(_p,brain,request)=>{writes.push(brain.model);if(brain.provider==='gemini'&&writes.length>1)throw Object.assign(new Error('Gemini billing blocked'),{code:'AI_BILLING_BLOCKED'});if(brain.provider==='openai'){assert.equal(request.editorialFeedback.issues[0].category,'overexplaining');assert.equal(request.revisionDraft.lines[0].text,rawScene().lines[0].text);assert.deepEqual(request.characters,input.characters);}return {brain,text:JSON.stringify(rawScene())};},reviewStudio:async(_p,brain)=>{assert.deepEqual(brain,reviewerBrain);return {brain,text:JSON.stringify(review(++reviews===1))};}};
 await assert.rejects(editStudioScene({...options(ai),writerBrain:gemini,onCheckpoint:j=>saved=j}),error=>error.code==='AI_BILLING_BLOCKED');const previous=structuredClone(saved);assert.equal(previous.status,'revising');
 const result=await editStudioScene({...options(ai),previous:saved});assert.deepEqual(writes,['gemini-4-argon','gemini-4-argon','gpt-6-astra']);assert.equal(result.journal.status,'approved');assert.equal(result.journal.attempts.length,2);assert.deepEqual(result.journal.attempts[0],previous.attempts[0]);assert.deepEqual(result.journal.attempts[1].brain,writerBrain);assert.deepEqual(result.journal.reviewerBrain,reviewerBrain);assert.deepEqual(saved,previous);
 const fresh={writeStudio:async(_p,brain,request)=>{assert.equal(request.revisionDraft,undefined);return {brain,text:JSON.stringify(rawScene())};},reviewStudio:async(_p,brain)=>({brain,text:JSON.stringify(review())})};const changed=await editStudioScene({...options(fresh),input:{...input,writerNotes:'A changed brief must not silently reuse the earlier approval.'},previous:saved});assert.equal(changed.journal.attempts.length,1);
});

test('actionable optional notes on the first draft cause one automatic polish pass rather than being discarded',async()=>{
 let writes=0,reviews=0;const ai={writeStudio:async(_p,brain,request)=>{writes++;if(writes===2)assert.equal(request.editorialFeedback.issues[0].severity,'optional');return {brain,text:JSON.stringify(rawScene())};},reviewStudio:async(_p,brain)=>{reviews++;const r=review();r.issues=[{...review(true).issues[0],severity:'optional'}];return {brain,text:JSON.stringify(r)};}};
 const result=await editStudioScene(options(ai));assert.equal(writes,2);assert.equal(reviews,2);assert.equal(result.journal.status,'approved');assert.equal(result.journal.attempts[0].polishRequested,true);assert.equal(result.journal.attempts[1].polishRequested,false);
});
test('required feedback cannot be silently approved, reviewer line references are checked, and revision loops are bounded',async()=>{
 assert.throws(()=>validateSceneReview({...review(true),issues:[{...review(true).issues[0],lineNumbers:[99]}]},{lineCount:7}),/affected lines/);
 let writes=0,saved;const ai={writeStudio:async(_p,brain)=>{writes++;return {brain,text:JSON.stringify(rawScene())};},reviewStudio:async(_p,brain)=>({brain,text:JSON.stringify({...review(true),verdict:'approve'})})};
 await assert.rejects(editStudioScene({...options(ai),onCheckpoint:j=>saved=j}),error=>error.code==='EDITORIAL_REJECTED');assert.equal(writes,4);assert.equal(saved.status,'needs-attention');assert.equal(saved.attempts.length,4);
});
