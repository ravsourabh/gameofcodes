import {test,expect,type Page} from '@playwright/test';
import http from 'node:http';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createSessionService} from '../server/sessions.mjs';import {discussionFixtureAI} from './fixtures/discussion.mjs';
import {seedOfflineReplay,corrections,correctedBrief,offlineBrief} from '../scripts/fixtures/offline-leetcode.mjs';
import {currentScopeTurns,currentBrief} from '../shared/discussion-memory.mjs';import {discussionAction} from './fixtures/desktop';import {pinchAction} from './fixtures/xr';
let root:string,origin:string,server:http.Server,seeded:any,state:any;
const ideas=['Downloaded problem packs support focused practice without a connection.','A local judge must show failed examples so learners can inspect their reasoning.','An optional reflection after solving preserves attention without interrupting work.','Measure recovery after a mistake instead of total time spent at the keyboard.','A small pilot should compare an optional breathing pause with uninterrupted practice.','Keep the reset easy to skip so the learner controls their own pace.'];
test.beforeEach(async({page})=>{
 root=await mkdtemp(path.join(tmpdir(),'goc-repair-browser-'));seeded=await seedOfflineReplay(root);const fixture=discussionFixtureAI();state=fixture.state;state.briefProposal=structuredClone(offlineBrief);
 state.reply=(p:any,s:any)=>{const turns=currentScopeTurns(s),last=turns.at(-1),n=turns.length;return {text:ideas[n%ideas.length],position:ideas[n%ideas.length],kind:n<3?'opening':'answer',relatedIds:last?[last.id]:[],questionForParticipantId:null,onTopic:true,needsUserInput:false};};
 const service=createSessionService({root,ai:fixture.ai,onError:e=>console.error(e.stack)});server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url!,'http://localhost')));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`;
 await page.addInitScript(({profile})=>localStorage.setItem('goc-session-profiles-v1',JSON.stringify({schemaVersion:1,profiles:[{id:profile,name:'Conversation repair test'}],selectedId:profile})),{profile:seeded.profile});
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),response=await route.fetch({url:origin+url.pathname+url.search,headers:{...route.request().headers(),origin,host:new URL(origin).host}});await route.fulfill({response});});
 await page.goto('/?session='+seeded.session.id);await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');await page.locator('#quiet').click();
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'wait'});await page.close();await new Promise<void>(r=>{server.close(()=>r());server.closeAllConnections();});expect(root.startsWith(path.join(tmpdir(),'goc-repair-browser-'))).toBe(true);await rm(root,{recursive:true,force:true});});
const saved=async()=>(await(await fetch(`${origin}/api/sessions/${seeded.session.id}?profileId=${seeded.profile}`)).json()).session;
async function send(page:Page,text:string){await page.getByLabel('Your instruction').fill(text);await page.getByRole('button',{name:'Send instruction'}).click();}
async function correction(page:Page,text:string){await send(page,text);await expect(page.locator('.discussion-message')).toContainText('Direction saved for this discussion');}
async function step(page:Page,n:number){await discussionAction(page,'step');await expect.poll(async()=>(await saved()).contributions.length).toBe(n);await expect(page.locator('body')).toHaveAttribute('data-discussion-state','paused');}

test('the five corrections survive retries and reload, then three real characters exchange referenced turns',async({page})=>{
 // Ready state: a correction is captured before discussion startup or any form.
 state.failBrief=true;await send(page,corrections[0]);await expect(page.locator('.discussion-message')).toContainText('brief connection failure');expect((await saved()).discussion.interventions).toHaveLength(1);
 await page.getByRole('button',{name:'Send instruction'}).click();await expect(page.locator('.discussion-message')).toContainText('Direction saved for this discussion');expect((await saved()).discussion.interventions).toHaveLength(1);
 for(const text of corrections.slice(1)){state.briefProposal=structuredClone(text===corrections.at(-1)?correctedBrief:offlineBrief);await correction(page,text);}
 const original=(await saved()).scenario.situation;await page.reload();await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');await page.locator('#quiet').click();expect(currentBrief(await saved())!.topic).toBe(correctedBrief.topic);
 await send(page,'discuss it with others');await expect.poll(async()=>(await saved()).contributions.length,{timeout:20000}).toBeGreaterThan(0);await page.locator('#interrupt').click();await expect(page.locator('body')).toHaveAttribute('data-discussion-state','paused');
 for(let n=2;n<=4;n++)await step(page,n);
 const s=await saved(),turns=currentScopeTurns(s);expect(s.participants.filter((p:any)=>p.active)).toHaveLength(3);expect(new Set(turns.map(t=>t.participantId)).size).toBe(3);expect(turns[3].relatedIds).toContain(turns[2].id);expect(turns[3].participantId).not.toBe(turns[2].participantId);expect(s.discussion.interventions).toHaveLength(5);expect(s.scenario.situation).toBe(original);expect(turns.every(t=>!/line rate quote|delete code/i.test(t.text))).toBe(true);
 await expect(page.locator('body')).toHaveAttribute('data-realistic-avatars','4');await page.screenshot({path:'test-results/conversation-repair-group.png'});
});

test('a lost topic acknowledgement is retried without another correction or model call',async({page})=>{
 let lost=false;await page.route('**/api/discussion/*/brief?*',async route=>{const url=new URL(route.request().url()),response=await route.fetch({url:origin+url.pathname+url.search,headers:{...route.request().headers(),origin,host:new URL(origin).host}});if(!lost){lost=true;await route.abort('failed');}else await route.fulfill({response});});
 await send(page,corrections[0]);await expect(page.locator('.discussion-message')).toContainText('fetch');expect((await saved()).discussion.interventions).toHaveLength(1);expect(state.briefCalls).toHaveLength(1);
 await page.getByRole('button',{name:'Send instruction'}).click();await expect(page.locator('.discussion-message')).toContainText('Direction saved for this discussion');expect((await saved()).discussion.interventions).toHaveLength(1);expect(state.briefCalls).toHaveLength(1);
});

test('an essential question waits for the human; continue explicitly proceeds under assumptions',async({page})=>{
 state.reply=()=>({text:'Which single user group should the first trial recruit?',position:'Choose one pilot audience.',kind:'opening',relatedIds:[],questionForParticipantId:null,onTopic:true,needsUserInput:true});
 await page.locator('[data-guide="start-coaching"]').click();await expect.poll(async()=>(await saved()).contributions.length).toBe(1);await expect(page.locator('body')).toHaveAttribute('data-discussion-state','paused');await expect(page.getByRole('button',{name:'Continue with assumptions'})).toBeVisible();expect(state.calls).toHaveLength(1);expect((await saved()).discussion.runningSince).toBeNull();
 state.reply=(p:any,s:any)=>({text:ideas[0],position:ideas[0],kind:'answer',relatedIds:[s.contributions[0].id],questionForParticipantId:null,onTopic:true,needsUserInput:false});await page.getByRole('button',{name:'Continue with assumptions'}).click();await expect.poll(async()=>(await saved()).contributions.length).toBe(2);await page.locator('#interrupt').click();expect((await saved()).discussion.proceedWithAssumptions).toBe(true);
});

test.describe('native corrected discussion',()=>{test.describe.configure({timeout:150000});test.use({baseURL:'https://localhost:5443',ignoreHTTPSErrors:true});test('a hand invites real voices after a correction and headset exit pauses them',async({page})=>{
 state.briefProposal=structuredClone(correctedBrief);await correction(page,corrections.at(-1)!);
 const runtime=await readFile('node_modules/iwer/build/iwer.min.js','utf8');await page.addInitScript({content:`${runtime}\nwindow.xrDevice=new IWER.XRDevice(IWER.metaQuest3);window.xrDevice.installRuntime({forceInstall:true});window.xrDevice.primaryInputMode='hand';window.xrDevice.position.set(0,1.6,0);`});await page.reload();await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');await page.locator('#quiet').click();await page.getByRole('button',{name:'Enter VR',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(document.body.dataset.nativeSurfaces||'[]').flatMap((s:any)=>s.buttons).find((b:any)=>b.action==='discuss:resume')?.label)).toBe('Discuss with others');await pinchAction(page,'discuss:resume');await expect.poll(async()=>(await saved()).contributions.length,{timeout:20000}).toBeGreaterThan(0);await pinchAction(page,'discuss:pause');
 for(let n=2;n<=3;n++){await pinchAction(page,'discuss:step');await expect.poll(async()=>(await saved()).contributions.length).toBe(n);await expect(page.locator('body')).toHaveAttribute('data-discussion-state','paused');}
 expect(new Set(currentScopeTurns(await saved()).map(t=>t.participantId)).size).toBe(3);await expect(page.locator('body')).toHaveAttribute('data-realistic-avatars','4');await pinchAction(page,'discuss:resume');await pinchAction(page,'exit');await expect(page.locator('body')).toHaveAttribute('data-xr-active','false');await expect.poll(async()=>(await saved()).status).toBe('paused');expect(currentBrief(await saved())!.topic).toBe(correctedBrief.topic);
});});
