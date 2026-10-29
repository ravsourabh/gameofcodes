import {fields,text} from './validation.mjs';
import {validateSceneCraft} from './scene-craft.mjs';
export const REVIEW_CHECKS=['balanced','fresh','coherent','responsive','earnedEnding','inCharacter'];
export const REVIEW_CATEGORIES=['pacing','repetition','overexplaining','generic-voice','weak-payoff','missing-setup','unanswered-question','continuity','creator-notes'];
const family=model=>model.toLowerCase().replace(/[._:]/g,'-').replace(/-latest$/,'').replace(/-(?:20\d{2}(?:-?\d{2}){2}).*$/,'');
export const sameReviewModel=(a,b)=>!!a?.model&&!!b?.model&&!!a.provider&&a.provider===b.provider&&family(a.model)===family(b.model);
export function validateSceneReview(value,{lineCount=36}={}){
  fields(value,[...REVIEW_CHECKS,'reason','verdict','issues','preserveLines'],'scene review');
  if(REVIEW_CHECKS.some(key=>typeof value[key]!=='boolean')||!['approve','revise'].includes(value.verdict))throw new Error('The scene review was incomplete.');
  text(value.reason,900,'review reason',true);
  const lineNumbers=values=>Array.isArray(values)&&values.length<=36&&new Set(values).size===values.length&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=lineCount);
  if(!lineNumbers(value.preserveLines)||!Array.isArray(value.issues)||value.issues.length>8)throw new Error('Use actual line numbers in the editorial feedback.');
  for(const issue of value.issues){fields(issue,['lineNumbers','category','severity','problem','instruction'],'editorial issue');if(!lineNumbers(issue.lineNumbers)||!issue.lineNumbers.length||!REVIEW_CATEGORIES.includes(issue.category)||!['required','optional'].includes(issue.severity))throw new Error('Give each editorial issue valid affected lines and a category.');text(issue.problem,500,'editorial problem');text(issue.instruction,700,'editorial instruction');}
  if(value.verdict==='revise'&&!value.issues.some(issue=>issue.severity==='required'))throw new Error('A revision needs at least one specific required line edit.');
  if(REVIEW_CHECKS.some(key=>!value[key])&&!value.issues.some(issue=>issue.severity==='required'))throw new Error('A failed consistency check needs a specific required repair.');
  return value;
}
export const sceneReviewPassed=value=>REVIEW_CHECKS.every(key=>value[key]===true)&&value.verdict==='approve'&&!value.issues.some(issue=>issue.severity==='required');
export function validateEditorialJournal(value){
  if(value===undefined)return;fields(value,['schemaVersion','inputHash','atTurn','runId','writerBrain','reviewerBrain','status','inputs','attempts'],'editorial history');
  if(value.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(value.inputHash)||!Number.isInteger(value.atTurn)||value.atTurn<0||typeof value.runId!=='string'||!['writing','reviewing','revising','approved','needs-attention','outdated'].includes(value.status)||!Array.isArray(value.attempts)||value.attempts.length>4)throw new Error('Invalid editorial history.');
  const brain=b=>{fields(b,['provider','model'],'editorial model');text(b.provider,80,'model provider');text(b.model,160,'model name');};brain(value.writerBrain);brain(value.reviewerBrain);if(sameReviewModel(value.writerBrain,value.reviewerBrain))throw new Error('The reviewer must be a different model from the writer.');
  fields(value.inputs,['writerNotes','adultComedy'],'editorial inputs');text(value.inputs.writerNotes,4000,'applied writer notes',true);if(typeof value.inputs.adultComedy!=='boolean')throw new Error('Invalid applied comedy setting.');
  for(const [index,attempt]of value.attempts.entries()){
    fields(attempt,['number','at','brain','draft','reviewBrain','review','failure','polishRequested'],'editorial attempt');if(attempt.number!==index+1||typeof attempt.at!=='string'||attempt.polishRequested!==undefined&&typeof attempt.polishRequested!=='boolean')throw new Error('Invalid editorial attempt order.');brain(attempt.brain);if(attempt.failure!==undefined)text(attempt.failure,1200,'editorial failure');
    if(attempt.draft){fields(attempt.draft,['summary','lines','detourUsed','introductions','sceneCraft','headline'],'editorial draft');text(attempt.draft.summary,1200,'draft summary');if(attempt.draft.headline!==undefined)text(attempt.draft.headline,100,'writer headline');validateSceneCraft(attempt.draft.sceneCraft,[...new Set(attempt.draft.lines.map(line=>line.characterId))]);if(!Array.isArray(attempt.draft.lines)||attempt.draft.lines.length>36||!attempt.draft.lines.length||attempt.draft.lines.some(line=>typeof line.text!=='string'||line.text.length>500))throw new Error('Invalid saved editorial draft.');}
    if(attempt.review){brain(attempt.reviewBrain);if(sameReviewModel(attempt.brain,attempt.reviewBrain))throw new Error('The writer cannot approve its own draft.');validateSceneReview(attempt.review,{lineCount:attempt.draft?.lines.length||36});}
  }
  if(value.status==='approved'&&(!value.attempts.at(-1)?.draft||!value.attempts.at(-1)?.review||!sceneReviewPassed(value.attempts.at(-1).review)))throw new Error('An approved scene needs a passing independent review.');
}
