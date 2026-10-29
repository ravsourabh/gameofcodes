import {createHash} from 'node:crypto';
import {SessionError} from '../shared/session-domain.mjs';
import {sameReviewModel,validateEditorialJournal} from '../shared/studio/editorial.mjs';
import {SCENE_REVIEW_SCHEMA,validateSceneReview,sceneReviewPassed} from './studio-review.mjs';
import {writerSchema,normaliseWriterScene,validateWriterScene} from './studio-writer.mjs';
const parse=text=>JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
const failure=(message,code)=>new SessionError(message,502,code);
export async function resolveStudioReviewer(ai,writer,selected){
  if(selected){if(sameReviewModel(writer,selected))throw failure('Choose a Script reviewer different from the dialogue writer in Settings.','REVIEWER_CONFLICT');await ai.validateAssignment(selected,null);return selected;}
  const catalogue=await ai.catalog(),preferred=['claude-opus-5-5','gpt-6-astra','gemini-4-argon','grok-4.7'];
  const choices=catalogue.providers.flatMap(p=>p.models.map(m=>({provider:p.id,model:m.id}))).filter(brain=>!sameReviewModel(writer,brain));
  choices.sort((a,b)=>Number(a.provider===writer.provider)-Number(b.provider===writer.provider)||(preferred.includes(a.model)?preferred.indexOf(a.model):99)-(preferred.includes(b.model)?preferred.indexOf(b.model):99));
  if(!choices.length)throw failure('Connect or select a different AI model for Script reviewer in Settings. A writer cannot approve its own script.','REVIEWER_UNAVAILABLE');
  await ai.validateAssignment(choices[0],null);return choices[0];
}
export async function editStudioScene({ai,profileId,writerBrain,reviewerBrain,input,budget,cast,initial,hostId,signal,previous,onCheckpoint=async()=>{},onPhase=()=>{}}){
  const fingerprint=(writerBrain,reviewerBrain)=>createHash('sha256').update(JSON.stringify({craftVersion:1,input,writerBrain,reviewerBrain})).digest('hex'),inputHash=fingerprint(writerBrain,reviewerBrain);
  // An explicit writer change can recover a paused revision without throwing
  // away its draft and independent feedback. Changed scene inputs still reset.
  const writerHandoff=previous&&previous.inputHash===fingerprint(previous.writerBrain,previous.reviewerBrain)&&sameReviewModel(previous.reviewerBrain,reviewerBrain)&&['writing','reviewing','revising'].includes(previous.status);
  const journal=previous?.inputHash===inputHash||writerHandoff?structuredClone(previous):{schemaVersion:1,inputHash,atTurn:input.atTurn,runId:input.runId,writerBrain,reviewerBrain,status:'writing',inputs:{writerNotes:input.writerNotes||'',adultComedy:!!input.adultComedy},attempts:[]};
  journal.inputHash=inputHash;journal.writerBrain=writerBrain;journal.reviewerBrain=reviewerBrain;
  const checkpoint=async()=>{if(signal?.aborted)throw failure('Script preparation paused. Saved drafts are kept.','INTERRUPTED');validateEditorialJournal(journal);await onCheckpoint(structuredClone(journal));};
  const request={...input};let repairDraft=null;
  for(;;){
    if(signal?.aborted)throw failure('Script preparation paused. Saved drafts are kept.','INTERRUPTED');
    let attempt=journal.attempts.at(-1);
    if(attempt?.review&&sceneReviewPassed(attempt.review)&&!attempt.polishRequested){journal.status='approved';await checkpoint();return {scene:attempt.draft,brain:attempt.brain,journal};}
    if(!attempt?.draft||attempt.review||attempt.failure){
      const previousAttempt=attempt;
      if(journal.attempts.length>=4){journal.status='needs-attention';await checkpoint();throw failure('The independent reviewer still found required edits after automatic revisions. Drafts and feedback are saved under Script review. Change reviewer or writer notes, then Resume; your previous show is kept.','EDITORIAL_REJECTED');}
      if(previousAttempt){request.automaticPolish=!!previousAttempt.polishRequested;request.recovery=previousAttempt.failure||(previousAttempt.polishRequested?'Apply the independent editor’s optional line edits in one polish pass: ':'Independent editor: ')+previousAttempt.review.reason;request.editorialFeedback=previousAttempt.review||null;const draft=previousAttempt.draft||repairDraft;if(draft)request.revisionDraft=draft.introductions?{...draft,lines:draft.lines.slice(draft.introductions.length)}:draft;request.revisionMode=journal.attempts.length===3?'fresh-structure':'targeted';}
      journal.status=journal.attempts.length?'revising':'writing';onPhase(journal.status);await checkpoint();
      const written=await ai.writeStudio(profileId,writerBrain,request,writerSchema(cast,budget),signal);attempt={number:journal.attempts.length+1,at:new Date().toISOString(),brain:written.brain};journal.attempts.push(attempt);
      onPhase('checking');
      try{
        const scene=normaliseWriterScene(parse(written.text),{cast,initial,hostId,characters:input.characters,language:input.language});repairDraft=scene;
        validateWriterScene(scene,{cast,firstSpeakerId:input.firstSpeakerId,hostId,initial,history:input.history,banter:initial?input.conversationDetour:null,requireClosing:true,minLines:initial&&scene.introductions===undefined?budget.dialogueMinLines:budget.minLines,maxLines:initial&&scene.introductions===undefined?budget.dialogueMaxLines:budget.maxLines});attempt.draft=scene;
      }catch(error){attempt.failure=String(error.message).slice(0,1200);await checkpoint();continue;}
      journal.status='reviewing';await checkpoint();
    }
    if(sameReviewModel(attempt.brain,reviewerBrain))throw failure('The resolved writer and reviewer are the same model. Choose a different Script reviewer.','REVIEWER_CONFLICT');
    journal.status='reviewing';onPhase('reviewing');
    const prior=journal.attempts.at(-2),checked=await ai.reviewStudio(profileId,reviewerBrain,{...input,proposedScene:attempt.draft,previousReview:prior?.review||null,previousScene:prior?.draft||null,automaticPolish:!!prior?.polishRequested},SCENE_REVIEW_SCHEMA,signal);
    if(sameReviewModel(attempt.brain,checked.brain))throw failure('The reviewer returned the writer’s model identity. The scene has not been approved.','REVIEWER_CONFLICT');
    try{attempt.review=validateSceneReview(parse(checked.text),{lineCount:attempt.draft.lines.length});attempt.reviewBrain=checked.brain;}catch(error){throw failure('The independent review was incomplete. The draft is saved; Resume retries its review. '+error.message,'INVALID_REVIEW');}
    // An otherwise accepted first draft still gets one automatic polish pass
    // when the independent editor supplies actionable optional improvements.
    attempt.polishRequested=attempt.number===1&&sceneReviewPassed(attempt.review)&&attempt.review.issues.length>0;
    journal.status=sceneReviewPassed(attempt.review)&&!attempt.polishRequested?'approved':'revising';await checkpoint();
  }
}
