import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin = process.env.GOC_VERIFY_URL || 'https://gameofcodes.si';
const project = randomUUID();
async function post(endpoint, input, expected = 200) {
  const response = await fetch(`${origin}/api/court/${endpoint}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(180000) });
  const raw = await response.text();let data;try{data=JSON.parse(raw);}catch{throw new Error(`${endpoint}: server returned HTTP ${response.status} instead of JSON`);} assert.equal(response.status, expected, `${endpoint}: ${data.error || response.status}`); return data;
}
const status = await fetch(`${origin}/api/court/status?project=${project}`).then(r=>r.json());
assert.equal(status.mode, 'cloud');assert.equal(status.onboarded, false);
assert.equal(status.providers.find(p=>p.id==='muse').state,'disabled');
await post('brain',{project,role:'virus',provider:'muse'},503);
console.log('PASS cloud status and unavailable Muse rejection');
await post('brain',{project,role:'virus',provider:'gemini'});
const plan=await post('plan-idea',{project,idea:'Build a small reading tracker for students. Add a book title, mark it read, and save the list in localStorage. No external services.',requestId:randomUUID()});
assert.ok(plan.charter.milestones.length>0);assert.equal(plan.proposal.status,'awaiting-approval');
console.log(`PASS assigned-brain idea planning (${plan.charter.milestones.length} suggested milestones)`);
await post('complete-onboarding',{project});
const returned=await fetch(`${origin}/api/court/status?project=${project}`).then(r=>r.json());
const fresh=await fetch(`${origin}/api/court/status?project=${randomUUID()}`).then(r=>r.json());
assert.equal(returned.onboarded,true);assert.equal(fresh.onboarded,false);assert.equal(returned.charter.idea,plan.charter.idea);
console.log('PASS returning-project persistence and independent fresh-project onboarding');
const speech=await fetch(`${origin}/api/court/voice`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({role:'virus',text:'Welcome back. Your court is ready.'}),signal:AbortSignal.timeout(25000)});
assert.equal(speech.status,200);const wav=Buffer.from(await speech.arrayBuffer());
assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);assert.notEqual(wav.toString('ascii',44,47),'ID3');
assert.ok(wav.readUInt32LE(40)>48000);console.log(`PASS actual ElevenLabs PCM speech (${(wav.readUInt32LE(40)/48000).toFixed(1)}s)`);
if(process.argv.includes('--build')){
  await post('brain',{project,role:'builder',provider:'gemini'});
  const requestId=randomUUID();const accepted=await post('build',{project,proposalId:plan.proposal.id,requestId,async:true},202);
  assert.equal(accepted.pending,true);let build;const deadline=Date.now()+360000;
  while(Date.now()<deadline){const job=await fetch(`${origin}/api/court/build-status?project=${project}&requestId=${requestId}`).then(r=>r.json());if(job.status==='error')throw new Error(job.error);if(job.status==='complete'){build=job.result;break;}await new Promise(r=>setTimeout(r,1000));}
  assert.ok(build,'Build did not finish before the verification deadline');
  assert.ok(build.artifact);assert.ok(build.checks.every(check=>check.passed!==false));
  const source=await fetch(`${origin}/api/court/files?project=${project}`).then(r=>r.json());
  assert.deepEqual(Object.keys(source.files).sort(),['app.css','app.js','index.html']);
  assert.ok(source.files['index.html'].length>0);console.log('PASS actual Gemini build, browser startup checks and code retrieval');
}
console.log(`Verification project: ${project}`);
