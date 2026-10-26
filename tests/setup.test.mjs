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
import {createSessionAI} from '../server/session-ai.mjs';
import {extractContext} from '../server/context-extract.mjs';
import http from 'node:http';
import {createSessionService} from '../server/sessions.mjs';

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
test('setup inference receives user statements and reviewed excerpts only, validates output and keeps actual model attribution',async()=>{
  let {session:s,guide,profileId}=fixture();guide.brain={provider:'openai',model:'gpt-fixture'};let prompt='',invalid=false;
  const ai=createSessionAI({env:{OPENAI_API_KEY:'test-only'},transport:async(url,options)=>{
    if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-fixture'}]});
    prompt=JSON.parse(options.body).input;return Response.json({model:'gpt-fixture-resolved',output:[{content:[{type:'output_text',text:JSON.stringify(invalid?{...proposal(),durationMinutes:-1}:proposal())}]}]});
  }});
  s=change(s,'capture',{text:'My own sentence.'});s=change(s,'context',{item:{id:randomUUID(),name:'Private draft',status:'pending',text:'UNREVIEWED CONTENT',error:''}});
  const c={id:randomUUID(),name:'Approved excerpt',status:'pending',text:'REVIEWED CONTENT',error:''};s=change(s,'context',{item:c});s=change(s,'review-context',{id:c.id});
  const result=await ai.setup(profileId,guide,s);assert.equal(result.brain.model,'gpt-fixture-resolved');assert.match(prompt,/My own sentence/);assert.match(prompt,/REVIEWED CONTENT/);assert.doesNotMatch(prompt,/UNREVIEWED CONTENT/);
  invalid=true;await assert.rejects(ai.setup(profileId,guide,s),/incomplete setup/);
});
test('plain text and PDF extraction expose only bounded reviewable text and report unreadable documents',async()=>{
  const plain=await extractContext({name:'notes.txt',mime:'text/plain',data:Buffer.from('A useful constraint.').toString('base64')});assert.equal(plain.status,'pending');assert.equal(plain.text,'A useful constraint.');
  const bad=await extractContext({name:'scan.pdf',mime:'application/pdf',data:Buffer.from('%PDF-broken').toString('base64')});assert.equal(bad.status,'unreadable');assert.equal(bad.text,'');
  await assert.rejects(extractContext({name:'large.txt',mime:'text/plain',data:Buffer.alloc(2_000_001).toString('base64')}),/2 MB/);
  // A minimal actual text PDF, parsed by PDF.js rather than a mocked extraction response.
  const stream='BT /F1 12 Tf 10 30 Td (Reviewed research method) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n',offsets=[0];for(const [i,obj] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const parsed=await extractContext({name:'research.pdf',mime:'application/pdf',data:Buffer.from(pdf).toString('base64')});assert.equal(parsed.status,'pending');assert.match(parsed.text,/research method/);
});
test('setup HTTP enforces ownership and provenance, and replays a committed proposal without another model request',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'goc-setup-http-'));let calls=0;
 const service=createSessionService({root,ai:{validateAssignment:async()=>{},setup:async()=>{calls++;return {proposal:proposal(),brain:{provider:'fixture',model:'resolved'}};}}});
 const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,profileId=randomUUID();
 const call=async(route,input,method=input?'POST':'GET',originHeader=origin)=>{const res=await fetch(origin+route,{method,headers:{origin:originHeader,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});return {status:res.status,data:await res.json()};};
 try{
  let {session:s}=(await call('/api/sessions?profileId='+profileId,{id:randomUUID(),requestId:randomUUID(),draft:{title:'Setup check',mode:'discussion',situation:''}})).data;
  const route=`/api/sessions/${s.id}?profileId=${profileId}`,setup='/api/ai/setup?profileId='+profileId;
  const input=()=>({sessionId:s.id,requestId:randomUUID(),expectedRevision:s.revision});
  assert.equal((await call(setup,input(),'POST','https://wrong.example')).status,403);assert.equal((await call('/api/ai/setup?profileId='+randomUUID(),input())).status,404);
  assert.equal((await call(route,{action:'guidance',operation:'propose',requestId:randomUUID(),expectedRevision:s.revision,payload:{proposal:proposal(),brain:{provider:'invented',model:'invented'}}},'PATCH')).status,403);
  ({session:s}=(await call('/api/ai/assign?profileId='+profileId,{...input(),characterId:s.guidance.guide.id,brain:{provider:'fixture',model:'requested'},voice:{provider:'browser',id:'default'}})).data);
  assert.equal((await call(setup,input())).status,400);
  ({session:s}=(await call(route,{action:'guidance',operation:'capture',requestId:randomUUID(),expectedRevision:s.revision,payload:{text:'Defend my research.'}},'PATCH')).data);
  const request=input();const first=await call(setup,request);assert.equal(first.status,200);assert.equal(first.data.session.guidance.setup.brain.model,'resolved');
  assert.equal((await call(setup,request)).data.replayed,true);assert.equal(calls,1);
  assert.equal((await call(setup,{...request,requestId:randomUUID()})).status,409);assert.equal(calls,1);
 }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});assert.ok(root.startsWith(path.join(tmpdir(),'goc-setup-http-')));await rm(root,{recursive:true,force:true});}
});
