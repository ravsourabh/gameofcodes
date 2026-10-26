import {randomUUID} from 'node:crypto';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createCharacterLibrary} from '../../server/character-library.mjs';
import {generateCharacter,characterFields} from '../../shared/character-domain.mjs';
import {createSession,updateRoster} from '../../shared/session-domain.mjs';
import {SessionError} from '../../shared/session-domain.mjs';
import {changeSetup} from '../../shared/setup-domain.mjs';
const fields=c=>characterFields({name:c.name,avatar:c.avatar,personality:c.personality,code:c.code,voicePreference:c.voicePreference});
export async function seedDiscussion(root,{castSize=2}={}){
 const profile=randomUUID(),store=createCharacterLibrary({root});let library=await store.get(profile);const guide=library.characters[0];guide.brain={provider:'openai',model:'gpt-fixture'};guide.voice={provider:'browser',id:'default'};
 library=(await store.mutate(profile,{requestId:randomUUID(),expectedRevision:library.revision,action:'update',id:guide.id,character:fields(guide),assignment:{brain:guide.brain,voice:guide.voice}})).library;
 const people=Array.from({length:castSize},(_,i)=>generateCharacter(profile,{seed:i+1}));
 for(const [i,c] of people.entries()){c.name=['Elian','Bryn','Rowan','Sage','Noor'][i];c.brain=i?{provider:'anthropic',model:'claude-fixture'}:{provider:'openai',model:'gpt-fixture'};c.voice={provider:'browser',id:'default'};library=(await store.mutate(profile,{requestId:randomUUID(),expectedRevision:library.revision,action:'create',id:c.id,character:fields(c),assignment:{brain:c.brain,voice:c.voice}})).library;}
 let s=createSession({profileId:profile,requestId:randomUUID(),guide,draft:{title:'Pilot funding',mode:'discussion',situation:''}});
 s=updateRoster(s,{requestId:randomUUID(),expectedRevision:s.revision,entries:people.map((c,i)=>({characterId:c.id,role:i?'Sceptic':'Proponent'}))},people);
 for(const [operation,payload] of [['capture',{text:'Should we fund a small pilot?'}],['propose',{brain:guide.brain,proposal:{title:'Pilot funding',mode:'discussion',format:'hearing',intensity:'probing',situation:'Should we fund a small pilot?',goal:'Understand costs and evidence gaps.',constraints:[],durationMinutes:10,rubric:[{name:'Evidence',description:'Distinguish facts and assumptions.'}],cast:[{name:'Elian',role:'Proponent',reason:'Explore the potential.',code:'Test ideas.',personality:'Curious'}]}}],['confirm-notes',{}],['approve',{}]])s=changeSetup(s,{requestId:randomUUID(),expectedRevision:s.revision,operation,payload});
 const folder=path.join(root,'.sovereign','sessions','v1',profile);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,s.id+'.json'),JSON.stringify(s));return {profile,session:s};
}
export function discussionFixtureAI(){
 const state={calls:[],gate:null,fail:false,failStart:false};
 const ai={catalog:async()=>({providers:[{id:'openai',name:'OpenAI',status:'Explicit test fixture',models:[{id:'gpt-fixture',name:'Fixture'}],audioModels:[]},{id:'anthropic',name:'Claude',status:'Explicit test fixture',models:[{id:'claude-fixture',name:'Fixture'}],audioModels:[]}],voices:[],voiceStatus:'Fixture: captions',localStatus:'Unavailable'}),validateAssignment:async()=>{if(state.failStart){state.failStart=false;throw new SessionError('Explicit temporary brain connection failure',503,'AI_UNAVAILABLE');}},
 discussion:async(_profile,_character,p,s,signal)=>{state.calls.push({participantId:p.id,brain:p.brain,pending:s.discussion.interventions.filter(i=>!i.consumedBy)});if(state.gate)await state.gate;if(state.fail){state.fail=false;throw new SessionError('Explicit provider unavailable fixture',503,'AI_UNAVAILABLE');}
 const n=s.discussion.turnsUsed,last=s.contributions.at(-1),text=['A small pilot could test whether there is demand.','The pilot should first have a firm spending cap.','Bryn, the cap alone does not cover recruitment cost. How will you include it?','I would include recruitment and stop the pilot if total cost exceeds the cap.'][n]||`Response ${n}: consider the latest direction and retain the cost limit.`;
 return {brain:{provider:p.brain.provider,model:p.brain.model+'-resolved'},reply:{text,position:n===3?'Fund only with recruitment inside the cap.':`Position ${n}: test demand with cost controls.`,kind:n<2?'opening':n===2?'objection':'answer',relatedIds:last?[last.id]:[],questionForParticipantId:n===2?last.participantId:null,onTopic:true}};
 },speak:async()=>{throw new Error('Explicit voice unavailable fixture');}};return {state,ai};
}
