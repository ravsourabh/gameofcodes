import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createSessionService} from '../server/sessions.mjs';import {seedDiscussion,discussionFixtureAI} from './fixtures/discussion.mjs';
async function fixture(run){const root=await mkdtemp(path.join(tmpdir(),'goc-discussion-http-'));const seeded=await seedDiscussion(root),{state,ai}=discussionFixtureAI();let service=createSessionService({root,ai});const server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let s=seeded.session;
 const call=async(action,fields={},originHeader=origin)=>{const response=await fetch(`${origin}/api/discussion/${s.id}/${action}?profileId=${seeded.profile}`,{method:'POST',headers:{origin:originHeader,'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),expectedRevision:s.revision,...fields})});const data=await response.json();if(data.session)s=data.session;return {status:response.status,data};};
 try{await run({call,state,origin,profile:seeded.profile,get session(){return s;},refresh:async()=>{s=(await(await fetch(`${origin}/api/sessions/${s.id}?profileId=${seeded.profile}`)).json()).session;return s;},restart:()=>service=createSessionService({root,ai})});}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});assert.ok(root.startsWith(path.join(tmpdir(),'goc-discussion-http-')));await rm(root,{recursive:true,force:true});}}
test('HTTP discussion commits a multi-model objection/answer, replays once and survives restart',async()=>fixture(async f=>{
 assert.equal((await f.call('control',{operation:'start'},'https://wrong.example')).status,403);await f.call('control',{operation:'start'});
 for(let i=0;i<4;i++){const requestId=randomUUID(),response=await f.call('turn',{requestId});assert.equal(response.status,200,response.data.error);assert.equal((await f.call('turn',{requestId})).data.replayed,true);}
 assert.equal(f.session.contributions.length,4);assert.equal(f.state.calls.length,4);assert.equal(new Set(f.session.contributions.map(c=>c.brain.provider)).size,2);assert.equal(f.session.contributions[3].relatedIds[0],f.session.contributions[2].id);
 f.restart();assert.equal((await f.refresh()).contributions.length,4);await f.call('control',{operation:'finish'});assert.equal(f.session.status,'completed');assert.match(f.session.outcomes.at(-1).summary,/No final user decision/);
}));
test('HTTP pause interrupts held inference, rejects late output and directs the next turn',async()=>fixture(async f=>{
 await f.call('control',{operation:'start'});let release;f.state.gate=new Promise(r=>release=r);const pending=f.call('turn');await new Promise(r=>setTimeout(r,80));
 assert.equal((await f.call('control',{operation:'intervene',action:'evidence',text:'What evidence supports demand?',characterId:f.session.participants[1].characterId})).status,200);release();assert.equal((await pending).status,409);await f.refresh();assert.equal(f.session.contributions.length,0);assert.equal(f.session.status,'paused');
 f.state.gate=null;await f.call('control',{operation:'resume'});await f.call('turn');assert.equal(f.session.contributions[0].participantId,f.session.participants[1].id);assert.equal(f.session.discussion.interventions[0].consumedBy,f.session.contributions[0].id);
}));
test('HTTP provider failure pauses without committing a fabricated contribution or retrying automatically',async()=>fixture(async f=>{
 await f.call('control',{operation:'start'});f.state.fail=true;assert.equal((await f.call('turn')).status,503);await f.refresh();assert.equal(f.session.status,'paused');assert.equal(f.session.contributions.length,0);assert.equal(f.state.calls.length,1);assert.equal((await f.call('turn')).status,409);assert.equal(f.state.calls.length,1);
}));
test('the durable group-turn cap pauses before another provider request and cannot be bypassed by resume',async()=>fixture(async f=>{
 await f.call('control',{operation:'start'});for(let i=0;i<20;i++)assert.equal((await f.call('turn')).status,200);
 assert.equal(f.state.calls.length,20);assert.equal((await f.call('turn')).status,429);assert.equal(f.session.status,'paused');assert.match(f.session.discussion.reason,/budget/);assert.equal(f.state.calls.length,20);
 assert.equal((await f.call('control',{operation:'resume'})).status,409);assert.equal((await f.refresh()).discussion.turnsUsed,20);assert.equal(f.state.calls.length,20);
}));
test('a disconnected client durably pauses the clock and cannot commit its late response',async()=>fixture(async f=>{
 await f.call('control',{operation:'start'});let release;f.state.gate=new Promise(r=>release=r);const controller=new AbortController();
 const pending=fetch(`${f.origin}/api/discussion/${f.session.id}/turn?profileId=${f.profile}`,{method:'POST',headers:{origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),expectedRevision:f.session.revision}),signal:controller.signal}).catch(error=>error);
 const until=Date.now()+4000;while(!f.state.calls.length&&Date.now()<until)await new Promise(r=>setTimeout(r,10));assert.equal(f.state.calls.length,1);controller.abort();await pending;await new Promise(r=>setTimeout(r,40));release();
 for(let i=0;i<30;i++){if((await f.refresh()).status==='paused')break;await new Promise(r=>setTimeout(r,20));}
 assert.equal(f.session.status,'paused');assert.equal(f.session.discussion.runningSince,null);assert.equal(f.session.contributions.length,0);
}));
test('retrying a failed initial brain check can start and commit the first turn',async()=>fixture(async f=>{
 const requestId=randomUUID();f.state.failStart=true;assert.equal((await f.call('control',{operation:'start',requestId})).status,503);assert.equal(f.session.discussion,undefined);
 assert.equal((await f.call('control',{operation:'start',requestId})).status,200);const turn=await f.call('turn');assert.equal(turn.status,200,turn.data.error);assert.equal(f.session.contributions.length,1);
}));
