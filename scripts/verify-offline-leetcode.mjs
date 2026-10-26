// Bounded live replay of the failed conversation in a new temporary store.
// At most 22 real model requests, no speech calls, and no original-session writes.
import http from 'node:http';import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createSessionService} from '../server/sessions.mjs';import {createSessionAI} from '../server/session-ai.mjs';import {seedOfflineReplay,corrections} from './fixtures/offline-leetcode.mjs';import {currentBrief,currentScopeTurns} from '../shared/discussion-memory.mjs';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const starts=[],requests=[],transcript=[],retired=/line rate quote|(?:offline )?delete code/i;let total=0;
const destination=process.env.GOC_REPLAY_REPORT||path.resolve('.sovereign/review/offline-leetcode-live.json');await mkdir(path.dirname(destination),{recursive:true});
const transport=async(url,options)=>{
 if(options?.method==='POST'&&/\/responses$|\/messages$|:generateContent$/.test(url)){
  assert.ok(++total<=22,'The replay model-request cap was reached.');const recent=starts.filter(t=>Date.now()-t<61000);if(recent.length>=9){const delay=61050-(Date.now()-recent[0]);console.log(JSON.stringify({waitingForMinuteBudget:true,seconds:Math.ceil(delay/1000)}));await new Promise(r=>setTimeout(r,delay));}
  const body=JSON.parse(options.body),input=body.input||body.messages?.[0]?.content||body.contents?.[0]?.parts?.[0]?.text||'{}';let payload;try{payload=JSON.parse(input);}catch{payload={};}starts.push(Date.now());requests.push({provider:new URL(url).hostname,model:body.model||url.split('/models/')[1]?.split(':')[0],repair:!!payload.recovery});
 }
 const response=await fetch(url,options);if(!response.ok&&options?.method==='POST')console.error(JSON.stringify({provider:new URL(url).hostname,status:response.status}));return response;
};
const ai=createSessionAI({transport}),catalog=await ai.catalog(),nano={provider:'openai',model:'gpt-5.4-nano'},mini={provider:'openai',model:'gpt-5.4-mini'},haiku={provider:'anthropic',model:'claude-haiku-4-5-20251001'};
for(const brain of [nano,mini,haiku])assert.ok(catalog.providers.find(p=>p.id===brain.provider)?.models.some(m=>m.id===brain.model),`The live replay requires ${brain.provider}/${brain.model}.`);
const root=await mkdtemp(path.join(tmpdir(),'goc-offline-live-')),seeded=await seedOfflineReplay(root,{brain:nano}),service=createSessionService({root,ai}),server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,profile=seeded.profile;let session=seeded.session;
const mutation=(fields={})=>({requestId:randomUUID(),expectedRevision:session.revision,...fields});
async function call(route,input){const response=await fetch(origin+route,{method:input?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}),data=await response.json();assert.ok(response.ok,data.error||`HTTP ${response.status}`);if(data.session)session=data.session;return data;}
const discussion=(part,fields={})=>call(`/api/discussion/${session.id}/${part}?profileId=${profile}`,mutation(fields));
const pause=async()=>{if(session.status==='running')await discussion('control',{operation:'pause'});};
async function turn(stage,corrected=true){
 if(session.status!=='running')await discussion('control',{operation:'resume'});const {contribution:c}=await discussion('turn');
 if(corrected){assert.ok(!retired.test(c.text+' '+c.position),'A retired topic returned.');assert.equal(c.needsUserInput,false,'The corrected idea was blocked by another intent question.');assert.match(c.text,/offline|mindful|practi[cs]e|problem|reflection|local|focus|design|test|prototype|learning|exercise|session|distraction|harness|package|content|judg|sync|internet|breath|pause|meditat/i,'The turn did not discuss a concrete aspect of the idea.');}
 const p=session.participants.find(p=>p.id===c.participantId),entry={stage,speaker:session.characters.find(x=>x.id===p.characterId).name,participantId:p.id,brain:c.brain,scopeVersion:c.scopeVersion,text:c.text,position:c.position,relatedIds:c.relatedIds,id:c.id};transcript.push(entry);console.log(JSON.stringify(entry));await pause();
}
try{
 await discussion('control',{operation:'start',style:'coaching'});await turn('Recreated legacy setup',false);
 for(const [index,text] of corrections.entries()){
  await discussion('control',{operation:'intervene',action:'say',text,characterId:seeded.hostId});await discussion('brief');assert.ok(currentBrief(session).sourceIds.length===index+1);console.log(JSON.stringify({correction:index+1,text,workingBrief:currentBrief(session).topic,retiredTopics:currentBrief(session).excludedTopics,scopeVersion:currentBrief(session).scopeVersion}));
  if(index===1){await call('/api/ai/assign?profileId='+profile,{sessionId:session.id,...mutation(),characterId:seeded.hostId,brain:mini,voice:{provider:'browser',id:'default'}});}
  if(index<corrections.length-1){await turn('After correction '+(index+1));if(index===0)await turn('Later turn without another correction');}
 }
 assert.match(currentBrief(session).topic,/mindful|mindfulness|reflection|meditat/i);const group=await discussion('cast'),cast=group.session.participants.filter(p=>p.active);assert.equal(cast.length,3);assert.equal(new Set(cast.map(p=>p.characterId)).size,3);
 await call('/api/ai/assign?profileId='+profile,{sessionId:session.id,...mutation(),characterId:cast[1].characterId,brain:haiku,voice:{provider:'browser',id:'default'}});
 for(let i=0;i<4;i++)await turn('Real group exchange '+(i+1));
 const groupTurns=transcript.filter(t=>t.stage.startsWith('Real group'));assert.equal(new Set(groupTurns.map(t=>t.participantId)).size,3);assert.equal(new Set(groupTurns.map(t=>t.brain.provider)).size,2);assert.ok(groupTurns.some(t=>t.relatedIds.some(id=>groupTurns.some(other=>other.id===id&&other.participantId!==t.participantId))),'The group did not engage another character’s actual argument.');
 assert.ok(currentScopeTurns(session).every(t=>!retired.test(t.text)));await discussion('control',{operation:'finish'});
 const result={passed:true,at:new Date().toISOString(),runtimeRevision:JSON.parse(await readFile('dist/release.json','utf8')).revision,modelRequests:total,repairs:requests.filter(r=>r.repair).length,corrections:corrections.length,workingBrief:currentBrief(session),participants:cast.map(p=>({name:session.characters.find(c=>c.id===p.characterId).name,role:p.role})),transcript,outcome:session.outcomes.at(-1).summary};
 await writeFile(destination,JSON.stringify(result,null,2));await writeFile(destination.replace(/\.json$/,'')+'.md',['# Offline / mindfulness LeetCode replay','',`Passed: ${result.passed}; ${total} actual model requests; ${result.repairs} bounded repairs.`, '', '## Current working idea', '', result.workingBrief.topic, '', '## Corrections replayed', '', ...corrections.map((text,i)=>`${i+1}. ${text}`), '', '## Actual model conversation', '', ...transcript.flatMap(t=>[`### ${t.stage} - ${t.speaker}`, '', `${t.brain.provider} / ${t.brain.model}`, '', t.text, '', `Position: ${t.position}`, '']), '## Outcome', '', result.outcome, ''].join('\n'));console.log(JSON.stringify({passed:true,modelRequests:total,repairs:result.repairs,corrections:5,groupSpeakers:3,actualProviders:[...new Set(groupTurns.map(t=>t.brain.provider))],report:destination}));
}catch(error){await writeFile(destination,JSON.stringify({passed:false,at:new Date().toISOString(),error:error.message,modelRequests:total,requests,transcript,workingBrief:currentBrief(session)},null,2));await writeFile(destination.replace(/\.json$/,'')+'.md',`# Replay failed\n\n${error.message}\n\nInspect the accompanying JSON for the partial conversation.\n`);throw error;}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});assert.ok(root.startsWith(path.join(tmpdir(),'goc-offline-live-')));await rm(root,{recursive:true,force:true});}
