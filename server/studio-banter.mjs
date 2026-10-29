import {createHash} from 'node:crypto';
// Identity supplies a stable seed; a fresh production ID supplies fresh timing.
// Neither retrying a request nor replaying a take rerolls a character's details.
const random=seed=>{let index=0;return count=>createHash('sha256').update(`${seed}/${index++}`).digest().readUInt32BE(0)%count;};
const pick=(roll,values)=>values[roll(values.length)];
export const BANTER_TOPICS=['routine','hobby','smallPride','petPeeve','contradiction'];
export function comicCharacterDetails(characterId){
  const roll=random('comic-character-v1/'+characterId);
  const possession=pick(roll,['bus tickets','old keys','bottle caps','tiny notebooks','matchboxes','train timetables','shopping receipts','postcards','broken watches','fridge magnets','cinema stubs','spare buttons','pencils','tea coasters','marbles','paper bags']);
  const activity=pick(roll,['carrom','balcony gardening','kite flying','crossword puzzles','packing picnic lunches','repairing umbrellas','guessing film songs','making chutney','drawing maps','paper folding','street cricket','organising books','whistling','memorising bus routes','badminton','making paper boats']);
  const irritation=pick(roll,['people borrowing a pen and keeping its cap','wet spoons in the sugar jar','someone skipping a queue','a chair that rocks','a clock that runs two minutes fast','people saying they are arriving while still at home','unlabelled lunch boxes','a missing TV remote','change given as sweets','doorbells pressed twice','voice notes with a long silent beginning','a biscuit falling into tea','plastic covers left on new furniture','someone moving their slippers']);
  const easy=pick(roll,['remembering cricket scores','mental arithmetic','finding bargains','remembering faces','packing a suitcase','reading maps','recognising birds','tying knots','remembering birthdays','spotting spelling mistakes','arranging flowers','guessing song titles']);
  const failure=pick(roll,['finding their own glasses','remembering where they parked','keeping a houseplant alive','folding a fitted sheet','remembering why they entered a room','opening a stubborn jar','returning borrowed containers','remembering their own shopping list','keeping two socks together','finding the end of a roll of tape']);
  return {
    routine:`Sets ${2+roll(6)} morning alarms, then negotiates with the last alarm for ${2+roll(9)} more minutes.`,
    hobby:`Keeps ${9+roll(83)} ${possession} and insists the collection will be useful one day.`,
    smallPride:`Once finished ${pick(roll,['second','third','fourth'])} in a neighbourhood ${activity} contest and still brings it up.`,
    petPeeve:`Gets disproportionately annoyed by ${irritation}.`,
    contradiction:`Proud of being good at ${easy}, but repeatedly struggles with ${failure}.`,
    manner:pick(roll,['Quietly competitive about trivial things.','Too eager to supply an exact number.','Tries to sound practical while defending an impractical habit.','Takes a small personal achievement surprisingly seriously.','Quick to tease, then embarrassed when the same logic applies to them.','Treats a household rule as if everyone already knows it.','Reluctantly admits an ordinary, endearing failure.','Sounds very confident until asked for one concrete example.']),
  };
}
export function planBanter({runId,cast,turnCount,format,mode,hasBeats=false}){
  if(!['deadpan-meme','funny-news'].includes(format)||mode==='scripted'||hasBeats||turnCount<6||turnCount<cast.length+2)return null;
  const panel=cast.filter(member=>member.slotId!=='host');if(panel.length<2)return null;
  const roll=random('comic-detour-v1/'+runId);if(roll(100)>=35)return null;
  const initiator=panel[roll(panel.length)],targets=panel.filter(member=>member.characterId!==initiator.characterId);
  return {schemaVersion:1,startIndex:1+roll(turnCount>=7?2:1),initiatorId:initiator.characterId,targetId:targets[roll(targets.length)].characterId,topic:pick(roll,BANTER_TOPICS),device:pick(roll,['mock-expert theory','unexpected comparison','status reversal','over-literal deduction','self-own'])};
}
export function applyBanter(schedule,banter){
  if(!banter)return schedule;
  const result=schedule.map((beat,index)=>index>=banter.startIndex&&index<=banter.startIndex+2?{...beat,speakerId:index===banter.startIndex+1?banter.targetId:banter.initiatorId}:beat);
  // A conversational exchange must not silently remove another panellist's turn.
  for(const id of new Set(schedule.map(beat=>beat.speakerId))){if(result.some(beat=>beat.speakerId===id))continue;const index=result.findIndex((beat,index)=>index>0&&index<result.length-1&&(index<banter.startIndex||index>banter.startIndex+2)&&result.filter(item=>item.speakerId===beat.speakerId).length>1);if(index>=0)result[index]={...result[index],speakerId:id};}
  return result;
}
export function banterDirection(production,actorId,history){
  const b=production.banter;if(!b)return null;const index=production.cursor-b.startIndex;
  if(index<0||index>2)return null;
  if(actorId!==(index===1?b.targetId:b.initiatorId))return null;
  return {stage:['ask','answer','connect'][index],topic:b.topic,device:b.device,initiatorId:b.initiatorId,targetId:b.targetId,latestActualLine:history.at(-1)?.text||null};
}
