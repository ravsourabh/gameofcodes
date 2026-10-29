import {createStudioDirector} from './studio-director.mjs';
import {validateScreenSourceUrl} from '../shared/studio/screen-source.mjs';
import {directorCapabilities} from '../shared/studio/orchestration.mjs';
import {createHash} from 'node:crypto';
import {SessionError,isId} from '../shared/session-domain.mjs';
import {CHANNELS,validateChannel as checkChannel,studioCatalogue} from '../shared/studio/channels.mjs';
import {planEpisode as checkPlan,episodeInput} from '../shared/studio/episodes.mjs';
import {validateStudioRecord,legacySessionView} from '../shared/studio/records.mjs';
import {fields as checkFields} from '../shared/studio/validation.mjs';
import {createStudioStore} from './studio-store.mjs';
import {createStudioCharacters} from './studio-characters.mjs';
import {activeTurns} from '../shared/studio/production.mjs';
import {sarvamVoice} from '../shared/studio/voices.mjs';
import {createStudioSpeech} from './studio-speech.mjs';
import {createStudioProduction} from './studio-production.mjs';
import {createStudioOutput} from './studio-output.mjs';
import {validateEdition,defaultEdition} from '../shared/studio/edition.mjs';
import {createStudioAvatars} from './studio-avatars.mjs';
import {avatarRendering} from '../shared/studio/avatar-rendering.mjs';
import {createStudioPublishing} from './studio-publishing.mjs';
import {approvedStoryTake} from '../shared/studio/story-history.mjs';

const fail=(message,status=400,code)=>{throw new SessionError(message,status,code);};
const contract=check=>(...args)=>{try{return check(...args);}catch(error){if(error instanceof SessionError)throw error;fail(error.message);}};
const fields=contract(checkFields),validateChannel=contract(checkChannel),planEpisode=contract(checkPlan);
const id=value=>{if(!isId(value))fail('Invalid studio identifier.');return value.toLowerCase();};
const json=(res,status,data)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(data));
const signature=value=>createHash('sha256').update(canonical(value)).digest('hex');
function canonical(value){return Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);}
function sameOrigin(req){try{const origin=new URL(req.headers.origin);return req.headers['sec-fetch-site']!=='cross-site'&&['http:','https:'].includes(origin.protocol)&&origin.host===(req.headers['x-forwarded-host']||req.headers.host);}catch{return false;}}
async function body(req){
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')fail('Use application/json.',415);
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1_000_000)fail('This studio request is too large.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Invalid JSON.');}
}
function receipt(record,input,operation){
  const hash=signature({operation,input});const prior=record?.events.find(event=>event.requestId===input.requestId);
  if(prior){if(prior.signature!==hash)fail('This request identifier was used for a different studio operation.',409,'REQUEST_CONFLICT');return {hash,replayed:true};}
  if(record){
    if(record.revision!==input.expectedRevision||record.epoch!==input.expectedEpoch)fail('The studio record changed. Reload before trying again.',409,'REVISION_CONFLICT');
    if(record.events.length>=1000)fail('This studio record has reached its change limit.',413);
  }
  return {hash,replayed:false};
}
function event(input,operation,hash,revision,epoch,at){return {requestId:input.requestId,operation,signature:hash,revision,epoch,at};}
function first(profileId,recordId,kind,input,hash,operation){const now=new Date().toISOString();return {schemaVersion:1,kind,id:recordId,profileId,revision:1,epoch:0,createdAt:now,updatedAt:now,events:[event(input,operation,hash,1,0,now)]};}
function advance(record,input,operation,hash,invalidate=false){
  const next=structuredClone(record);next.revision++;if(invalidate)next.epoch++;
  next.updatedAt=new Date().toISOString();next.events.push(event(input,operation,hash,next.revision,next.epoch,next.updatedAt));return next;
}

export function createStudioService({root,characters,loadLegacySession,ai,onError=()=>{},replace,speech:providedSpeech,publishing:providedPublishing}){
  const store=createStudioStore({root,validate:validateStudioRecord,replace});
  const avatars=createStudioAvatars({root});
  const publishing=providedPublishing||createStudioPublishing({root});
  const people=createStudioCharacters({root,legacy:characters,episodes:store});
  const library=profileId=>people.get(profileId);
  async function owned(profileId,assignments){
    if(!Array.isArray(assignments)||assignments.some(member=>!member||typeof member!=='object'))fail('Choose valid character assignments.');
    const saved=await library(profileId),ids=saved?.characters.map(character=>character.id)||[];
    if(assignments.some(member=>!isId(member.characterId)||!ids.includes(member.characterId)))fail('Recall characters saved in this profile before assigning the cast.',400,'UNKNOWN_CHARACTER');
    return saved;
  }
  function plan(input,channel,saved){return planEpisode(input,{channel,characterIds:saved?.characters.map(character=>character.id)||[],characterProfiles:Object.fromEntries((saved?.characters||[]).filter(actor=>actor.studioProfile).map(actor=>[actor.id,actor.studioProfile]))});}
  const speech=providedSpeech||createStudioSpeech({root,ai});
  const production=createStudioProduction({store,people,ai,speech,owned,plan,receipt,advance,first,fail,onError});
  const output=createStudioOutput({root});
  const director=createStudioDirector({store,people,ai,receipt,advance,fail});
  return {
    async handle(req,res,url){
      try{
        if(await publishing.handle(req,res,url))return;
        if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Use the studio service from this application.'});
        if(url.pathname==='/api/studio/catalog'&&req.method==='GET')return json(res,200,studioCatalogue());
        if(url.pathname==='/api/studio/avatar-renderers'&&req.method==='GET')return json(res,200,await avatars.catalogue());
        if(url.pathname==='/api/studio/orchestration/capabilities'&&req.method==='GET')return json(res,200,directorCapabilities());
        const profileId=id(url.searchParams.get('profileId'));
        const directing=/^\/api\/studio\/channels\/([0-9a-f-]+)\/orchestrate$/.exec(url.pathname);
        if(directing){
          if(req.method!=='POST')fail('Use POST for a studio direction.',405);if(!sameOrigin(req))fail('Direction requires this application.',403);
          const input=await body(req);fields(input,['requestId','expectedRevision','expectedEpoch','episodeId','episodeRevision','episodeEpoch','text','playback'],'director instruction');id(input.requestId);if(input.episodeId)id(input.episodeId);
          const controller=new AbortController(),closed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',closed);
          try{return json(res,200,await director.plan(profileId,id(directing[1]),input,controller.signal));}finally{res.off('close',closed);}
        }

        const mediaFile=/^\/api\/studio\/media\/([a-f0-9]{64})(\/info)?$/.exec(url.pathname),exportFile=/^\/api\/studio\/exports\/([a-f0-9-]{36})(?:\/(recording|retry|finish|chunks\/\d+|video|download|captions|subtitles|manifest))?$/.exec(url.pathname);
        if(req.method==='DELETE'&&exportFile&&!exportFile[2]){if(!sameOrigin(req))fail('Export deletion requires this application.',403);return json(res,200,await output.remove(profileId,id(exportFile[1])));}
        if(req.method==='GET'&&mediaFile?.[2])return json(res,200,{asset:await output.getMedia(profileId,mediaFile[1])});
        if(req.method==='GET'&&mediaFile)return await output.serve(req,res,profileId,'media',mediaFile[1]);
        if(req.method==='GET'&&url.pathname==='/api/studio/exports')return json(res,200,{exports:await output.list(profileId)});
        if(req.method==='GET'&&exportFile){const action=exportFile[2];if(!action)return json(res,200,{job:await output.get(profileId,id(exportFile[1]))});if(action==='download'&&!sameOrigin({headers:{...req.headers,origin:req.headers.origin||req.headers.referer}}))fail('Download this export from the studio.',403);return await output.serve(req,res,profileId,'exports',id(exportFile[1]),{video:'mp4',download:'download',captions:'vtt',subtitles:'srt',manifest:'json'}[action]);}
        if(url.pathname==='/api/studio/media'&&req.method==='POST'||exportFile&&req.method==='POST'){
          if(!sameOrigin(req))fail('Media changes require this application.',403);
          if(exportFile?.[2]==='finish')return json(res,200,{job:await output.finish(profileId,id(exportFile[1]))});
          if(exportFile?.[2]==='retry')return json(res,200,{job:await output.encode(profileId,id(exportFile[1]))});
          if(req.headers['content-type']?.split(';')[0]!=='application/octet-stream')fail('Use a binary media upload.',415);
          const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(exportFile?200000000:80000000))fail('Media upload too large.',413);chunks.push(chunk);}const bytes=Buffer.concat(chunks);
          if(exportFile?.[2]?.startsWith('chunks/'))return json(res,200,{job:await output.chunk(profileId,id(exportFile[1]),Number(exportFile[2].split('/')[1]),bytes)});
          if(exportFile){if(exportFile[2]!=='recording')fail('Choose an export recording route.');return json(res,200,{job:await output.recording(profileId,id(exportFile[1]),bytes)});}
          return json(res,201,{asset:await output.media(profileId,bytes,url.searchParams.get('mime'),url.searchParams.get('name'))});
        }
        if(url.pathname==='/api/studio/exports'&&req.method==='POST'){
          if(!sameOrigin(req))fail('Exports require this application.',403);const input=await body(req);fields(input,['id','episodeId','takeId','format','screen','subtitleMode'],'export');const record=await store.load(profileId,'episodes',id(input.episodeId)),take=record?.takes.find(take=>take.id===input.takeId);if(record?.deletedAt||take?.deletedAt||!take?.productionSnapshot)fail('Choose a saved performed take.',404);return json(res,201,{job:await output.create(profileId,input,take,record.id)});
        }
        if(url.pathname==='/api/studio/voices'&&req.method==='GET')return json(res,200,await speech.capabilities());
        const audio=/^\/api\/studio\/audio\/([a-f0-9]{64})$/.exec(url.pathname);
        if(audio&&req.method==='GET'){const asset=await speech.get(profileId,audio[1]);if(!asset)fail('No owned speech asset was found.',404);return json(res,200,{asset});}
        const produce=/^\/api\/studio\/channels\/([0-9a-f-]+)\/produce$/.exec(url.pathname);
        const perform=/^\/api\/studio\/episodes\/([0-9a-f-]+)\/production$/.exec(url.pathname);
        if(produce||perform||url.pathname==='/api/studio/speech-preview'){
          if(perform&&req.method==='GET'){const saved=await store.load(profileId,'episodes',id(perform[1]));if(!saved||saved.deletedAt)fail('Choose an owned episode.',404);const requestId=url.searchParams.get('requestId');if(requestId)id(requestId);const progress=await production.progress(profileId,saved.id,requestId);return json(res,200,progress.error?{pending:false,error:progress.error}:progress);}
          if(req.method!=='POST')fail('Use a supported production operation.',405);if(!sameOrigin(req))fail('Production requires this application.',403);
          const input=await body(req);id(input?.requestId);
          if(produce){fields(input,['requestId','expectedRevision','expectedEpoch','premise','source'],'cast-led show');if(input.premise!==undefined&&(typeof input.premise!=='string'||!input.premise.trim()||input.premise.length>4000))fail('Use a bounded premise.');if(input.source!==undefined&&!['written','spoken'].includes(input.source))fail('Use written or spoken attribution.');return json(res,200,await production.bootstrap(profileId,id(produce[1]),input));}
          const controller=new AbortController(),closed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',closed);
          try{
            if(!perform){fields(input,['requestId','characterId','language','voice'],'voice audition');const actors=await library(profileId),actor=actors?.characters.find(actor=>actor.id===input.characterId);if(!actor)fail('Save this character before auditioning.',404);const language=input.language;if(!language||!['hi-IN','en-IN'].includes(language.primary)||typeof language.codeSwitching!=='boolean')fail('Choose the audition language.');const preview=input.voice?{...actor,voice:sarvamVoice(input.voice,language.primary)}:actor;return json(res,200,{asset:await speech.prepare(profileId,preview,language.primary==='hi-IN'?'पापा बोले, मुंबई में पूरी समिति फिर चुप हो गई।':'Please bring the blue papers. Maybe this meeting needs a meeting.',language,controller.signal)});}
            fields(input,['requestId','expectedRevision','expectedEpoch','operation','mode','turnLimit','turnId','captions','positionMs','beatId','characterId','segment','text','locked','actionId','targetId','atMs','durationMs','intensity','prepareOnly','adaptive','detached','shot','atFraction'],'production');
            const episodeId=id(perform[1]);if(input.operation==='turn'&&input.detached===true){const saved=await store.load(profileId,'episodes',episodeId);if(!saved||saved.deletedAt)fail('Choose an owned episode.',404);return json(res,202,production.startDetached(profileId,episodeId,input));}return json(res,200,await(input.operation==='turn'?production.turn(profileId,episodeId,input,controller.signal):input.operation==='voice'?production.voice(profileId,episodeId,input,controller.signal):production.control(profileId,episodeId,input)));
          }finally{res.off('close',closed);}
        }
        if(url.pathname==='/api/studio/characters'&&req.method==='GET')return json(res,200,{library:await library(profileId),readOnly:true});
        if(url.pathname==='/api/studio/characters'&&req.method==='POST'){
          if(!sameOrigin(req))fail('Character changes require a same-origin request.',403);
          const input=await body(req);
          if(!input||typeof input!=='object'||Array.isArray(input))fail('Use a character operation.');
          if(input.profile?.canon!==undefined&&!Array.isArray(input.profile.canon))fail('Use a list of canon facts.');
          if(input.channelId&&!await store.load(profileId,'channels',id(input.channelId)))fail('Choose an owned channel.',404);
          if(input.profile?.canon?.some(fact=>fact.origin==='episode')){
            for(const fact of input.profile.canon.filter(fact=>fact.origin==='episode')){const source=await store.load(profileId,'episodes',id(fact.sourceEpisodeId));if(!source||fact.channelId&&source.plan.channelId!==fact.channelId)fail('Remembered facts need an owned source episode in the matching channel.');}
          }
          return json(res,200,await people.mutate(profileId,input));
        }
        if(url.pathname==='/api/studio/character-context'&&req.method==='GET'){
          const channelId=id(url.searchParams.get('channelId'));if(!await store.load(profileId,'channels',channelId))fail('Choose an owned channel.',404);
          return json(res,200,await people.context(profileId,{observerId:id(url.searchParams.get('observerId')),subjectId:id(url.searchParams.get('subjectId')),channelId}));
        }
        const premiseRoute=/^\/api\/studio\/channels\/([0-9a-f-]+)\/premise$/.exec(url.pathname);
        if(premiseRoute){
          if(req.method!=='POST')fail('Use a supported premise operation.',405);if(!sameOrigin(req))fail('Premise changes require a same-origin request.',403);
          const channelId=id(premiseRoute[1]),input=await body(req);fields(input,['requestId','expectedRevision','expectedEpoch','operation','noteId','text','source'],'premise');id(input.requestId);id(input.noteId);
          if(!['capture','confirm'].includes(input.operation))fail('Choose capture or confirm.');
          return await store.serial(profileId+'/channels/'+channelId,async()=>{
            const saved=await store.load(profileId,'channels',channelId);if(!saved)fail('Choose an owned channel.',404);
            const operation='premise.'+input.operation,ack=receipt(saved,input,operation);if(ack.replayed)return json(res,200,{channel:saved,replayed:true});
            const next=advance(saved,input,operation,ack.hash,true);next.setup||={schemaVersion:1,notes:[],currentNoteId:null};
            if(input.operation==='capture'){
              if(typeof input.text!=='string'||!input.text.trim()||input.text.length>4000||!['written','spoken'].includes(input.source))fail('Write or narrate a bounded premise.');
              if(next.setup.notes.length>=50)fail('This channel has reached its premise-history limit. Start a new channel.',413);
              if(next.setup.notes.some(note=>note.id===input.noteId))fail('This premise identifier is already used.',409);
              next.setup.notes.push({id:input.noteId,text:input.text,source:input.source,status:'captured',at:next.updatedAt,...(next.setup.currentNoteId?{supersedes:next.setup.currentNoteId}:{})});next.setup.currentNoteId=input.noteId;
            }else{
              if(input.text!==undefined||input.source!==undefined)fail('Confirmation must reference the captured words.');
              const note=next.setup.notes.find(note=>note.id===input.noteId);if(!note||note.id!==next.setup.currentNoteId)fail('Review the latest captured premise before confirming.');note.status='confirmed';
            }
            await store.persist(next,'channels');return json(res,200,{channel:next,replayed:false});
          });
        }
        const casting=/^\/api\/studio\/channels\/([0-9a-f-]+)\/cast$/.exec(url.pathname);
        if(casting){
          if(req.method!=='POST')fail('Use a supported casting operation.',405);if(!sameOrigin(req))fail('Casting requires a same-origin request.',403);
          const channelId=id(casting[1]),input=await body(req);fields(input,['requestId','expectedRevision','expectedEpoch','libraryRevision','slotId','characterId','create'],'casting');id(input.requestId);
          return await store.serial(profileId+'/channels/'+channelId,async()=>{
            const saved=await store.load(profileId,'channels',channelId);if(!saved)fail('Choose an owned channel.',404);
            const ack=receipt(saved,input,'cast.join');if(ack.replayed)return json(res,200,{channel:saved,library:await library(profileId),replayed:true});
            const slot=saved.definition.cast.find(slot=>slot.id===input.slotId);if(!slot||slot.membership==='guest')fail('Choose a regular channel slot. Guest appearances belong to episode rundowns.');
            if(input.create&&input.characterId)fail('Choose a saved person or accept a new one.');
            let characterId=input.characterId;
            if(input.create){
              fields(input.create,['id','expectedRevision','character','profile','assignment','origin','portrait'],'new cast member');characterId=id(input.create.id);
              if(input.create.profile?.canon!==undefined&&!Array.isArray(input.create.profile.canon))fail('Use a list of canon facts.');
              if(input.create.profile?.canon?.some(fact=>fact.origin==='episode'))fail('Approve remembered episode canon through the character editor first.');
              await people.mutate(profileId,{...input.create,requestId:input.requestId,action:'create',channelId});
            }
            characterId=id(characterId);const castLibrary=await owned(profileId,[{characterId}]);
            if(!input.create)await people.mutate(profileId,{requestId:input.requestId,expectedRevision:input.libraryRevision,action:'recall',id:characterId,channelId});
            const next=advance(saved,input,'cast.join',ack.hash,true);
            next.definition.defaultCast=(next.definition.defaultCast||[]).filter(member=>member.slotId!==slot.id&&member.characterId!==characterId);next.definition.defaultCast.push({slotId:slot.id,characterId});
            await store.persist(next,'channels');return json(res,200,{channel:next,library:await library(profileId),replayed:false});
          });
        }
        const legacy=/^\/api\/studio\/legacy-sessions\/([0-9a-f-]+)$/.exec(url.pathname);
        if(legacy&&req.method==='GET'){
          const saved=await loadLegacySession(profileId,id(legacy[1]));if(!saved)fail('No saved session was found in this profile.',404);
          return json(res,200,legacySessionView(saved));
        }
        const match=/^\/api\/studio\/(channels|episodes)(?:\/([0-9a-f-]+))?$/.exec(url.pathname);
        if(!match)fail('Unknown studio route.',404);
        const collection=match[1],recordId=match[2]?id(match[2]):null,singular=collection==='channels'?'channel':'episode';
        if(req.method==='GET'){
          if(recordId){const saved=await store.load(profileId,collection,recordId);if(!saved||saved.deletedAt)fail('No studio record was found in this profile.',404);return json(res,200,{[singular]:saved});}
          const result=await store.list(profileId,collection),channelId=url.searchParams.get('channelId');if(channelId)id(channelId);
          const records=result.records.filter(record=>!record.deletedAt&&(!channelId||collection==='channels'&&record.id===channelId||collection==='episodes'&&record.plan.channelId===channelId));
          return json(res,200,{[collection]:records.map(record=>collection==='channels'?{id:record.id,name:record.definition.name,templateId:record.templateId,revision:record.revision,updatedAt:record.updatedAt}:{id:record.id,channelId:record.plan.channelId,premise:record.plan.premise,status:record.status,revision:record.revision,takeCount:record.takes.filter(take=>!take.deletedAt).length,storyApproval:approvedStoryTake(record)?record.storyApproval:null,updatedAt:record.updatedAt}),unavailableCount:result.unavailableCount});
        }
        if(!['POST','PATCH'].includes(req.method)||req.method==='POST'&&recordId||req.method==='PATCH'&&!recordId)return json(res,405,{error:'Unsupported studio operation.'});
        if(!sameOrigin(req))fail('Studio changes require a same-origin request.',403);
        const input=await body(req);id(input?.requestId);
        if(req.method==='POST'){
          fields(input,collection==='channels'?['id','requestId','templateId','definition']:['id','requestId','channelId','plan'],'studio create');
          const newId=id(input.id),operation=collection+'.create';
          return await store.serial(profileId+'/'+collection+'/'+newId,async()=>{
            const existing=await store.load(profileId,collection,newId),ack=receipt(existing,input,operation);
            if(existing?.deletedAt)fail('This episode was deleted.',404);
            if(ack.replayed)return json(res,200,{[singular]:existing,replayed:true});
            if(existing)fail('This studio identifier is already saved.',409);
            let saved=first(profileId,newId,'studio-'+singular,input,ack.hash,operation);
            if(collection==='channels'){
              if(!Object.hasOwn(CHANNELS,input.templateId))fail('Choose a registered channel template.');
              const definition=input.definition===undefined?{...structuredClone(CHANNELS[input.templateId]),id:newId}:input.definition;
              validateChannel(definition);if(definition.id!==newId)fail('Channel identity mismatch.');await owned(profileId,definition.defaultCast||[]);
              if(definition.avatarRendering){await owned(profileId,definition.avatarRendering.assignments);try{await avatars.validateSelection(definition.avatarRendering);}catch(error){fail(error.message);}}
              Object.assign(saved,{templateId:input.templateId,definition});
            }else{
              const channel=await store.load(profileId,'channels',id(input.channelId));if(!channel)fail('Choose a saved channel in this profile.',404);
              fields(input.plan,['premise','formatId','writingMode','language','viewerMode','humanParticipant','cast','media','beats','cues'],'episode plan');
              const planned={...input.plan,id:newId,cast:input.plan.cast===undefined?(channel.definition.defaultCast||[]):input.plan.cast};
              const actors=await owned(profileId,planned.cast);Object.assign(saved,{plan:plan(planned,channel.definition,actors),channelRevision:channel.revision,status:'draft',takes:[],humanInputs:[]});
            }
            await store.persist(saved,collection);return json(res,201,{[singular]:saved,replayed:false});
          });
        }
        const operation=input.operation;
        const allowed=collection==='channels'?['revise','screen']:['revise','cancel','accept-take','human-input','headline','approve-story','unapprove-story','delete-take','delete'];
        if(!allowed.includes(operation))fail('Unsupported studio change.');
        fields(input,['requestId','expectedRevision','expectedEpoch','operation',...(collection==='channels'?['definition','screen']:operation==='headline'?['headline']:operation==='revise'?['plan']:operation==='accept-take'?['takeId','sourceTakeId','edition']:['approve-story','delete-take'].includes(operation)?['takeId']:operation==='human-input'?['beatId','participantId','text','source']:[])],'studio change');
        if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||!Number.isSafeInteger(input.expectedEpoch)||input.expectedEpoch<0)fail('Provide the saved studio revision and epoch.');
        return await store.serial(profileId+'/'+collection+'/'+recordId,async()=>{
          const saved=await store.load(profileId,collection,recordId);if(!saved)fail('No studio record was found in this profile.',404);
          if(saved.deletedAt&&operation!=='delete')fail('This episode was deleted.',404);
          const ack=receipt(saved,input,operation);if(ack.replayed)return json(res,200,{[singular]:saved,replayed:true});
          if(saved.deletedAt)fail('This episode was deleted.',404);
          const next=advance(saved,input,operation,ack.hash,['revise','cancel','delete'].includes(operation));
          if(collection==='channels'&&operation==='screen'){
            if(input.screen!==null){fields(input.screen,['assetId','muted','loop','startMs','sourceUrl'],'screen');validateScreenSourceUrl(input.screen.sourceUrl);await output.getMedia(profileId,input.screen.assetId);if(typeof input.screen.muted!=='boolean'||typeof input.screen.loop!=='boolean'||!Number.isFinite(input.screen.startMs)||input.screen.startMs<0)fail('Choose saved screen settings.');}next.screen=structuredClone(input.screen);
          }else if(collection==='channels'){
            validateChannel(input.definition);if(input.definition.id!==recordId)fail('Channel identity mismatch.');await owned(profileId,input.definition.defaultCast||[]);
            if(input.definition.avatarRendering){await owned(profileId,input.definition.avatarRendering.assignments);if(canonical(input.definition.avatarRendering)!==canonical(saved.definition.avatarRendering??null))try{await avatars.validateSelection(input.definition.avatarRendering);}catch(error){fail(error.message);}}
            next.definition=structuredClone(input.definition);
          }else if(operation==='approve-story'){
            const take=saved.takes.find(item=>item.id===id(input.takeId)&&!item.deletedAt);
            if(saved.status==='cancelled'||!take?.productionSnapshot)fail('Choose a saved performed version to approve.',409);
            next.storyApproval={takeId:take.id,approvedAt:next.updatedAt};
          }else if(operation==='unapprove-story')next.storyApproval=null;
          else if(operation==='delete'){
            next.deletedAt=next.updatedAt;next.storyApproval=null;
          }else if(operation==='delete-take'){
            const take=next.takes.find(item=>item.id===id(input.takeId)&&!item.deletedAt);if(!take)fail('Choose a saved version.',404);
            take.deletedAt=next.updatedAt;if(next.storyApproval?.takeId===take.id)next.storyApproval=null;
          }else if(operation==='headline'){if(input.headline!==null&&(typeof input.headline!=='string'||input.headline.length>100))fail('Use a screen headline of up to 100 characters.');next.headline=input.headline===null?null:input.headline.trim();
            if(input.headline===null&&!saved.production?.writer?.headline&&typeof ai.writeStudio==='function'){
              const room=await store.load(profileId,'channels',saved.plan.channelId),library=await owned(profileId,saved.plan.cast),host=library.characters.find(person=>person.id===saved.plan.cast.find(member=>member.slotId==='host')?.characterId),brain=room?.definition.writingBrain||host?.brain||saved.production?.writer?.brain;
              const result=await ai.writeStudio(profileId,brain,{titleOnly:true,premise:saved.plan.premise,language:saved.plan.language,summary:saved.production?.writer?.summary||'',lines:activeTurns(saved.production||{turns:[]}).map(({text})=>text)}, {type:'object',properties:{headline:{type:'string',minLength:1,maxLength:100}},required:['headline'],additionalProperties:false});
              const title=JSON.parse(result.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')).headline;
              if(typeof title!=='string'||!title.trim()||title.length>100||saved.plan.language.primary==='hi-IN'&&!/[\u0900-\u097f]/u.test(title))fail('The writer did not return a concise Hindi title. Try again.',502);
              if(next.production?.writer)next.production.writer.headline=title.trim();else next.headline=title.trim();
            }

          }else if(operation==='revise'){
            fields(input.plan,['premise','formatId','writingMode','language','viewerMode','humanParticipant','cast','media','beats','cues'],'episode plan');
            const planned={...input.plan,id:recordId},actors=await owned(profileId,planned.cast||[]);
            next.plan=plan(planned,saved.plan.channelSnapshot,actors);next.status='draft';
          }else if(operation==='cancel'){next.status='cancelled';next.storyApproval=null;}
          else{
            if(saved.status!=='draft')fail('Revise the cancelled episode before continuing.',409,'EPISODE_CANCELLED');
            if(operation==='human-input'){
              const beat=saved.plan.beats.find(beat=>beat.id===input.beatId);
              if(input.source!=='human'||saved.plan.viewerMode!=='participant'||!beat||beat.kind!=='human-input'||beat.speakerId!==input.participantId||input.participantId!==saved.plan.humanParticipant.id)fail('Supply an actual human response for a pending participant beat.');
              if(typeof input.text!=='string'||!input.text.trim()||input.text.length>4000)fail('Use a bounded human response.');
              if(saved.humanInputs.some(answer=>answer.epoch===saved.epoch&&answer.beatId===input.beatId))fail('This participant beat already has an answer. Revise before recording another.',409);
              if(saved.humanInputs.length>=100)fail('This episode has reached its human-response limit.',413);
              next.humanInputs.push({beatId:input.beatId,participantId:input.participantId,text:input.text,source:'human',epoch:saved.epoch,receivedAt:next.updatedAt,revision:next.revision});
            }else{
              const takeId=id(input.takeId);if(saved.takes.some(take=>take.id===takeId))fail('This take identifier is already saved.',409);
              if(saved.takes.length>=20)fail('This episode supports at most 20 accepted takes.',413);
              const answers=saved.humanInputs.filter(answer=>answer.epoch===saved.epoch);
              if(saved.plan.beats.some(beat=>beat.kind==='human-input'&&!answers.some(answer=>answer.beatId===beat.id)))fail('Wait for the actual human answers before accepting this take.',409,'WAITING_FOR_HUMAN');
              const actors=await owned(profileId,saved.plan.cast);
              const recorded=saved.production?activeTurns(saved.production):[],castSnapshots=saved.plan.cast.map(member=>structuredClone(recorded.find(turn=>turn.characterId===member.characterId)?.characterSnapshot||actors.characters.find(actor=>actor.id===member.characterId)));
              const acceptedPlan=plan(episodeInput(saved.plan),saved.plan.channelSnapshot,{...actors,characters:castSnapshots});
              next.takes.push({schemaVersion:1,kind:'studio-take',id:takeId,acceptedAt:next.updatedAt,sourceRevision:saved.revision,epoch:saved.epoch,channelRevision:saved.channelRevision,libraryRevision:actors.revision,planSnapshot:acceptedPlan,castSnapshots,humanInputs:structuredClone(answers)});
              if(saved.production)next.takes.at(-1).productionSnapshot=structuredClone(saved.production);
              const take=next.takes.at(-1);
              const currentChannel=await store.load(profileId,'channels',saved.plan.channelId);take.avatarRendering=avatarRendering(currentChannel?.definition.avatarRendering);
              if(input.sourceTakeId){const source=saved.takes.find(take=>take.id===input.sourceTakeId&&!take.deletedAt);if(!source?.productionSnapshot||source.planSnapshot.viewerMode!=='director')fail('Choose a saved director take to edit.');Object.assign(take,{sourceTakeId:source.id,planSnapshot:structuredClone(source.planSnapshot),castSnapshots:structuredClone(source.castSnapshots),productionSnapshot:structuredClone(source.productionSnapshot),avatarRendering:avatarRendering(source.avatarRendering)});}
              if(take.productionSnapshot){if(take.productionSnapshot.phase!=='ready'&&take.productionSnapshot.status!=='completed')fail('Finish preparation before accepting a performed take.',409);take.edition=input.edition||defaultEdition(take);try{validateEdition(take.edition,take);}catch(error){fail(error.message);}if(take.edition.screen)await output.getMedia(profileId,take.edition.screen.assetId);}
            }
          }
          if(collection==='episodes'&&['revise','cancel','delete'].includes(operation)){production.invalidate(next);production.abort(profileId,recordId);}
          await store.persist(next,collection);return json(res,200,{[singular]:next,replayed:false});
        });
      }catch(error){
        if(error instanceof SessionError)return json(res,error.status,{error:error.message,...(error.code?{code:error.code}:{})});
        onError(error);return json(res,500,{error:'The studio operation could not be completed. Saved data has been kept.'});
      }
    },
  };
}
