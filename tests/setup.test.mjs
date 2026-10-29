import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSession,assignCharacter,updateRoster} from '../shared/session-domain.mjs';
import {generateCharacter} from '../shared/character-domain.mjs';
import {changeSetup,validateProposal} from '../shared/setup-domain.mjs';
import {createCharacterLibrary} from '../server/character-library.mjs';

export const proposal=()=>({title:'Research defence',mode:'rehearsal',format:'panel',intensity:'probing',situation:'Defend a research proposal.',goal:'Explain and defend the method.',constraints:['Five minutes to present.'],durationMinutes:10,rubric:[{name:'Method',description:'Explain why this method answers the question.'}],cast:[{name:'Mira',role:'Methods examiner',reason:'Tests the research design.',code:'Ask for supporting evidence.',personality:'Patient and precise'}]});
const fixture=()=>{const profileId=randomUUID(),guide=generateCharacter(profileId,{guide:true});return {profileId,guide,session:createSession({profileId,requestId:randomUUID(),guide,draft:{title:'New situation',mode:'discussion',situation:''}})};};
const change=(s,operation,payload={})=>changeSetup(s,{requestId:randomUUID(),expectedRevision:s.revision,operation,payload});
test('setup preserves user words and prior readbacks, confirms interpretations explicitly and retries exactly once',()=>{
  let {session:s}=fixture();s=change(s,'capture',{text:'I’m defending my research proposal.'});assert.equal(s.guidance.setup.stage,'capture');assert.equal(s.guidance.notes[0].source,'user');
  const input={requestId:randomUUID(),expectedRevision:s.revision,operation:'propose',payload:{proposal:proposal(),brain:{provider:'openai',model:'fixture-resolved'}}};
  s=changeSetup(s,input);assert.equal(s.scenario.mode,'discussion');assert.equal(s.guidance.notes.at(-1).status,'unconfirmed');assert.equal(changeSetup(s,input),s);
  assert.throws(()=>change(s,'approve'),/Confirm/);s=change(s,'confirm-notes');assert.equal(s.scenario.mode,'rehearsal');assert.equal(s.guidance.notes.at(-1).status,'confirmed');
  s=change(s,'capture',{text:'Actually I have ten minutes, not five.'});assert.equal(s.guidance.setup.confirmedAt,null);assert.equal(s.guidance.notes.length,3);assert.equal(s.guidance.notes[1].status,'confirmed');
  assert.throws(()=>changeSetup(s,{...input,requestId:randomUUID()}),/another tab/);
});
test('context is bounded, cannot be preapproved and must be reviewed or removed before setup approval',()=>{
  let {session:s,guide,profileId}=fixture();const brain={provider:'openai',model:'fixture'},voice={provider:'browser',id:'default'};
  s=assignCharacter(s,{requestId:randomUUID(),expectedRevision:s.revision,characterId:guide.id,brain,voice});
  const person=generateCharacter(profileId);person.brain=brain;person.voice=voice;
  s=updateRoster(s,{requestId:randomUUID(),expectedRevision:s.revision,entries:[{characterId:person.id,role:'Examiner'}]},[person]);
  const item={id:randomUUID(),name:'Proposal',status:'pending',text:'Only this excerpt is available.',error:''};
  assert.throws(()=>change(s,'context',{item:{...item,status:'reviewed'}}),/reviewed/);
  s=change(s,'context',{item});s=change(s,'capture',{text:'Defend my proposal.'});s=change(s,'propose',{proposal:proposal(),brain});s=change(s,'confirm-notes');assert.throws(()=>change(s,'approve'),/Review or remove/);
  s=change(s,'review-context',{id:item.id});assert.equal(s.guidance.setup.confirmedAt,null);
  s=change(s,'propose',{proposal:proposal(),brain});s=change(s,'confirm-notes');s=change(s,'approve');assert.equal(s.status,'ready');assert.equal(s.exchanges?.length||0,0);
  assert.throws(()=>validateProposal({...proposal(),command:'start'}),/Unexpected/);
});
test('tutorial progress requires an action or skip and survives reload without completing later lessons',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'goc-setup-progress-'));try{const library=createCharacterLibrary({root}),profile=randomUUID();let saved=await library.get(profile);
    await assert.rejects(library.progress(profile,{requestId:randomUUID(),expectedRevision:saved.revision,lesson:'selection',status:'completed',evidence:'elapsed-time'}),/lesson action/);
    const input={requestId:randomUUID(),expectedRevision:saved.revision,lesson:'selection',status:'completed',evidence:'selected-guide'};
    saved=(await library.progress(profile,input)).library;assert.equal((await library.progress(profile,input)).replayed,true);
    saved=(await library.progress(profile,{requestId:randomUUID(),expectedRevision:saved.revision,lesson:'interruption',status:'skipped'})).library;
    const restored=await createCharacterLibrary({root}).get(profile);assert.equal(restored.guideProgress.lessons.selection,'completed');assert.equal(restored.guideProgress.lessons.interruption,'skipped');assert.equal(restored.guideProgress.lessons.scoring,'pending');assert.equal(restored.guideProgress.lessons.presenters,'pending');
    assert.equal((await library.get(randomUUID())).guideProgress.lessons.selection,'pending');
  }finally{assert.ok(root.startsWith(path.join(tmpdir(),'goc-setup-progress-')));await rm(root,{recursive:true,force:true});}
});
