import {fields} from './validation.mjs';
// Editable fictional characterisation. Canon visibility is separate from private
// psychology; reusing a character never grants a new cast all of its history.
const short=(value,max=400)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const strings=(value,max=20)=>Array.isArray(value)&&value.length<=max&&value.every(text=>short(text,300));
export function validateCharacterProfile(profile){
  fields(profile,['schemaVersion','characterId','revision','behaviour','psychology','likes','dislikes','backstory','canon'],'character profile');
  if(!profile||profile.schemaVersion!==1||!short(profile.characterId,100)||!Number.isSafeInteger(profile.revision)||profile.revision<1)throw new Error('A character profile needs a stable ID and revision.');
  if(!profile.behaviour||!short(profile.behaviour.speechStyle)||!strings(profile.behaviour.habits)||!Number.isFinite(profile.behaviour.energy)||profile.behaviour.energy<0||profile.behaviour.energy>1)throw new Error('Describe the character behaviour and bounded energy.');
  fields(profile.behaviour,['speechStyle','habits','energy'],'behaviour');
  const p=profile.psychology;
  if(!p||!strings(p.traits)||!strings(p.motivations)||!strings(p.values)||!short(p.stressResponse)||!short(p.conflictStyle))throw new Error('Describe traits, motivations, values and responses.');
  fields(p,['traits','motivations','values','stressResponse','conflictStyle'],'psychology');
  if(!strings(profile.likes)||!strings(profile.dislikes)||!short(profile.backstory,8000))throw new Error('Provide likes, dislikes and a bounded backstory.');
  if(!Array.isArray(profile.canon)||profile.canon.length>100)throw new Error('Character canon is limited to 100 facts.');
  const ids=new Set();
  for(const fact of profile.canon){
    fields(fact,['id','text','visibility','origin','channelId','sourceEpisodeId','sourceTakeId'],'canon fact');
    if(!fact||!short(fact.id,100)||ids.has(fact.id)||!short(fact.text,1000)||!['public','channel','private'].includes(fact.visibility)||!['creator','episode'].includes(fact.origin))throw new Error('Invalid or duplicate character canon fact.');ids.add(fact.id);
    if(fact.visibility==='channel'&&!short(fact.channelId,100))throw new Error('Channel-specific facts need their channel ID.');
    if(fact.origin==='episode'&&!short(fact.sourceEpisodeId,100))throw new Error('Remembered episode facts need their source.');
    if(fact.sourceTakeId!==undefined&&(fact.origin!=='episode'||!short(fact.sourceTakeId,100)))throw new Error('Remembered version facts need their source take.');
  }
  return profile;
}
export function starterProfile(character,{legacy=false}={}){
  const base={schemaVersion:1,characterId:character.id,revision:1,behaviour:{speechStyle:character.personality||'Conversational',habits:[],energy:.45},psychology:{traits:[],motivations:[],values:[character.code||'Make room for others.'],stressResponse:'Pauses before responding.',conflictStyle:'Challenges the idea respectfully.'},likes:[],dislikes:[],backstory:'No backstory recorded yet.',canon:[]};
  if(legacy)return base;
  const presets=[
    {style:'Measured, formal Hindi with an unhurried pause before a punchline.',habit:'Straightens the microphone before an absurd announcement.',traits:['Dry-witted','Meticulous'],motivation:'Give minor inconveniences the gravity of national events.',likes:['Old radios','Precise timekeeping'],dislikes:['Unnecessary committees'],backstory:'A fictional former late-night radio producer who catalogues failed jingles.',stress:'Becomes increasingly formal.',conflict:'Repeats an opponent’s premise with literal precision.',energy:.3},
    {style:'Warm Hinglish, curious questions and quick observations.',habit:'Makes a small note when someone contradicts themselves.',traits:['Curious','Playfully sceptical'],motivation:'Find the human detail behind an oversized claim.',likes:['Street food','Unexpected analogies'],dislikes:['Empty slogans'],backstory:'A fictional neighbourhood reporter who once hosted a cooking show with no working stove.',stress:'Asks one very practical question.',conflict:'Offers a concrete counterexample.',energy:.6},
    {style:'Serious delivery with exaggeratedly logical explanations.',habit:'Counts the reasons on their fingers.',traits:['Literal','Confident'],motivation:'Make the most complicated rule sound completely reasonable.',likes:['Debate clubs','Elaborate flowcharts'],dislikes:['Vague instructions'],backstory:'A fictional former school debate captain who treats everyday inconveniences as constitutional crises.',stress:'Produces an even more elaborate explanation.',conflict:'Challenges the hidden assumption.',energy:.75},
    {style:'Quiet, economical lines and a deliberately delayed reaction.',habit:'Looks at the speaker before delivering a short aside.',traits:['Observant','Patient'],motivation:'Notice the detail everybody else has missed.',likes:['Quiet tea breaks','Old stage comedies'],dislikes:['People interrupting the ending'],backstory:'A fictional stage comic who became a stern correspondent and keeps souvenirs from unsuccessful shows.',stress:'Pauses and lowers the intensity.',conflict:'Lets the other person finish, then supplies the missing detail.',energy:.25},
  ];
  const preset=presets[(character.avatar?.seed||0)%presets.length];
  base.behaviour={speechStyle:preset.style,habits:[preset.habit],energy:preset.energy};base.psychology={traits:preset.traits,motivations:[preset.motivation],values:[character.code||'Make room for others.'],stressResponse:preset.stress,conflictStyle:preset.conflict};base.likes=preset.likes;base.dislikes=preset.dislikes;base.backstory=preset.backstory;return structuredClone(base);
}
export function visibleCharacterFacts(profile,{channelId,knownFactIds=[]}={}){
  validateCharacterProfile(profile);
  return structuredClone(profile.canon.filter(fact=>fact.visibility==='public'||fact.visibility==='channel'&&fact.channelId===channelId&&knownFactIds.includes(fact.id)));
}
