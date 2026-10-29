import {createHash} from 'node:crypto';
import {createRecord,isId,validateRecord,SessionError} from '../shared/session-domain.mjs';
import {characterFields} from '../shared/character-domain.mjs';
import {fields,text,array} from '../shared/studio/validation.mjs';
import {validateCharacterProfile,visibleCharacterFacts} from '../shared/studio/characters.mjs';
import {createStudioStore} from './studio-store.mjs';
import {approvedEpisodeFact} from '../shared/studio/story-history.mjs';

const fail=(message,status=400,code='INVALID_STUDIO_CHARACTER')=>{throw new SessionError(message,status,code);};
const need=(condition,message)=>{if(!condition)fail(message);};
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}':JSON.stringify(value);
function validateLibrary(record){
  fields(record,['schemaVersion','kind','id','profileId','revision','createdAt','updatedAt','characters','events','knowledge','usage'],'studio character library');
  need(record.schemaVersion===1&&record.kind==='studio-character-library'&&isId(record.id)&&record.id===record.profileId,'Invalid studio library identity.');
  need(Number.isSafeInteger(record.revision)&&record.revision>=1&&record.revision===record.events?.length&&record.events.length<=1000,'Invalid studio library revision.');
  need(Number.isFinite(Date.parse(record.createdAt))&&Number.isFinite(Date.parse(record.updatedAt)),'Invalid library dates.');
  const ids=new Set();for(const actor of array(record.characters,100,'characters')){
    validateRecord(actor,'character');need(actor.profileId===record.profileId&&!ids.has(actor.id),'Invalid character ownership.');ids.add(actor.id);
    characterFields(Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(key=>[key,actor[key]])));
    validateCharacterProfile(actor.studioProfile);need(actor.studioProfile.characterId===actor.id,'Invalid rich-profile identity.');
    if(actor.portrait!==undefined)need(typeof actor.portrait==='string'&&actor.portrait.length<=160000&&/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(actor.portrait),'Invalid character portrait.');
    fields(actor.studioProvenance,['origin','approvedBy','legacyRevision'],'character provenance');
    need(['creator','legacy-enrichment','ai-proposal'].includes(actor.studioProvenance.origin)&&actor.studioProvenance.approvedBy==='creator','Approve character provenance.');
  }
  const requests=new Set();record.events.forEach((event,index)=>{fields(event,['requestId','revision','signature','at','action'],'character event');need(isId(event.requestId)&&!requests.has(event.requestId)&&event.revision===index+1&&/^[a-f0-9]{64}$/.test(event.signature)&&Number.isFinite(Date.parse(event.at)),'Invalid character receipt.');requests.add(event.requestId);});
  for(const item of array(record.knowledge,500,'learned facts')){fields(item,['observerId','subjectId','channelId','factId'],'learned fact');need([item.observerId,item.subjectId,item.channelId].every(isId)&&typeof item.factId==='string'&&item.factId.length<=100,'Invalid learned fact.');}
  for(const item of array(record.usage,100,'recent characters')){fields(item,['characterId','channelId','at'],'character use');need(isId(item.characterId)&&isId(item.channelId)&&Number.isFinite(Date.parse(item.at)),'Invalid character use.');}
  return record;
}

export function createStudioCharacters({root,legacy,episodes}){
  const store=createStudioStore({root,validate:validateLibrary});
  const load=profileId=>store.load(profileId,'characters',profileId);
  async function get(profileId){
    const [previous,saved]=await Promise.all([legacy.peek(profileId),load(profileId)]);
    if(!previous&&!saved)return null;
    const actors=new Map((previous?.characters||[]).map(actor=>[actor.id,structuredClone(actor)]));
    for(const actor of saved?.characters||[])actors.set(actor.id,structuredClone(actor));
    return {schemaVersion:1,kind:'studio-character-library',profileId,revision:(previous?.revision||0)+(saved?.revision||0),studioRevision:saved?.revision||0,legacyRevision:previous?.revision||0,characters:[...actors.values()],usage:saved?.usage||[],updatedAt:saved?.updatedAt||previous.updatedAt};
  }
  async function mutate(profileId,input){return store.serial(profileId,async()=>{
    try{
      fields(input,['requestId','expectedRevision','action','id','character','profile','assignment','origin','portrait','channelId','observerId','subjectId','factId','approvedCanon'],'character operation');
      need(isId(input.requestId)&&isId(input.id)&&Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0&&['create','update','recall','learn'].includes(input.action),'Invalid character operation.');
      const saved=await load(profileId),signature=createHash('sha256').update(stable(input)).digest('hex');
      const prior=saved?.events.find(event=>event.requestId===input.requestId);
      if(prior){if(prior.signature!==signature)fail('Character request already used for a different operation.',409,'REQUEST_CONFLICT');return {library:await get(profileId),replayed:true};}
      const current=await get(profileId);
      if((current?.revision||0)!==input.expectedRevision)fail('The character library changed. Reload before saving.',409,'REVISION_CONFLICT');
      const actor=current?.characters.find(actor=>actor.id===input.id),now=new Date().toISOString();
      const next=saved?structuredClone(saved):{schemaVersion:1,kind:'studio-character-library',id:profileId,profileId,revision:0,createdAt:now,updatedAt:now,characters:[],events:[],knowledge:[],usage:[]};
      if(next.events.length>=1000)fail('This character library has reached its change limit.',413);
      if(['create','update'].includes(input.action)){
        if(input.action==='create'&&actor)fail('This character identity is already saved.',409);
        if(input.action==='update'&&!actor)fail('No character was found in this profile.',404);
        if(!actor&&(current?.characters.length||0)>=100)fail('This profile supports at most 100 saved characters.',413);
        const base=characterFields(input.character);
        if(input.assignment){fields(input.assignment,['brain','voice'],'assignment');}
        const rich=structuredClone(input.profile);need(rich?.characterId===input.id,'Profile belongs to another character.');
        rich.revision=(actor?.studioProfile?.revision||0)+1;validateCharacterProfile(rich);
        const changedMemories=rich.canon.filter(fact=>fact.origin==='episode'&&stable(actor?.studioProfile?.canon.find(previous=>previous.id===fact.id))!==stable(fact));
        if(changedMemories.length&&input.approvedCanon!==true)fail('Approve remembered episode facts explicitly.');
        const record=actor?{...structuredClone(actor),...base,...input.assignment,updatedAt:now}:createRecord('character',profileId,{...base,brain:null,voice:null,...input.assignment},{id:input.id,now});
        record.studioProfile=rich;record.studioProvenance={origin:actor&&!actor.studioProfile?'legacy-enrichment':input.origin||'creator',approvedBy:'creator',...(actor&&!actor.studioProfile?{legacyRevision:current.legacyRevision}:{})};
        if(input.portrait!==undefined)record.portrait=input.portrait;
        validateRecord(record,'character');next.characters=next.characters.filter(item=>item.id!==record.id);next.characters.push(record);
      }else if(input.action==='recall'){
        if(!actor)fail('Recall a saved character in this profile.',404);need(isId(input.channelId),'Choose a channel for this recall.');
        next.usage=next.usage.filter(item=>item.characterId!==actor.id);next.usage.unshift({characterId:actor.id,channelId:input.channelId,at:now});next.usage=next.usage.slice(0,100);
      }else{
        need(isId(input.observerId)&&isId(input.subjectId)&&isId(input.channelId),'Choose a known observer, subject and channel.');
        need(current?.characters.some(actor=>actor.id===input.observerId),'Unknown observer.');
        const subject=current?.characters.find(actor=>actor.id===input.subjectId),fact=subject?.studioProfile?.canon.find(fact=>fact.id===input.factId);
        need(fact&&fact.visibility!=='private'&&(fact.visibility==='public'||fact.channelId===input.channelId),'Only approved public or matching-channel facts can be learned.');
        const item={observerId:input.observerId,subjectId:input.subjectId,channelId:input.channelId,factId:input.factId};
        if(!next.knowledge.some(known=>stable(known)===stable(item)))next.knowledge.push(item);
      }
      if(['create','update'].includes(input.action)&&input.channelId){need(isId(input.channelId),'Choose a channel.');next.usage=next.usage.filter(item=>item.characterId!==input.id);next.usage.unshift({characterId:input.id,channelId:input.channelId,at:now});next.usage=next.usage.slice(0,100);}
      next.revision++;next.updatedAt=now;next.events.push({requestId:input.requestId,revision:next.revision,signature,at:now,action:input.action});await store.persist(next,'characters');
      return {library:await get(profileId),replayed:false};
    }catch(error){if(error instanceof SessionError)throw error;if(error.code)throw error;fail(error.message);}
  });}
  async function context(profileId,{observerId,subjectId,channelId}){
    const current=await get(profileId),saved=await load(profileId);
    need(current?.characters.some(actor=>actor.id===observerId),'Unknown observing character.');
    const actor=current.characters.find(actor=>actor.id===subjectId);if(!actor)fail('Unknown character.',404);
    if(!actor.studioProfile)return {id:actor.id,name:actor.name,personality:actor.personality,code:actor.code,profile:null,canon:[]};
    const {canon,...fullProfile}=actor.studioProfile;
    // Another actor gets an approved public introduction, not the subject's
    // internal motivation/stress/conflict notes. Own-role context remains richer.
    const profile=observerId===subjectId?fullProfile:{schemaVersion:1,characterId:actor.id,revision:actor.studioProfile.revision,behaviour:{speechStyle:actor.studioProfile.behaviour.speechStyle},psychology:{traits:actor.studioProfile.psychology.traits},likes:actor.studioProfile.likes,dislikes:actor.studioProfile.dislikes,backstory:actor.studioProfile.backstory};
    const knownFactIds=(saved?.knowledge||[]).filter(item=>item.observerId===observerId&&item.subjectId===subjectId&&item.channelId===channelId).map(item=>item.factId);
    const visible=visibleCharacterFacts(actor.studioProfile,{channelId,knownFactIds}),sources=new Map();
    for(const fact of visible.filter(fact=>fact.origin==='episode'))if(!sources.has(fact.sourceEpisodeId))sources.set(fact.sourceEpisodeId,episodes?await episodes.load(profileId,'episodes',fact.sourceEpisodeId):null);
    return {id:actor.id,name:actor.name,profile,canon:visible.filter(fact=>approvedEpisodeFact(fact,sources.get(fact.sourceEpisodeId)))};
  }
  return {get,mutate,context};
}
