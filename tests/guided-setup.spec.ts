import {pinchAction,pinchWorld} from './fixtures/xr';
import {test,expect,type Page} from '@playwright/test';
import http from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSessionService} from '../server/sessions.mjs';
import {generateCharacter,characterFields} from '../shared/character-domain.mjs';

// These browser journeys use the real storage/service with an explicit deterministic AI fixture.
let server:http.Server,root:string,origin:string,calls=0,failSetup=false,lateSetup:Promise<void>|null=null;
const proposal=(s:any)=>({title:'Research defence',mode:'rehearsal',format:'panel',intensity:'probing',situation:s.guidance.notes.filter((n:any)=>n.source==='user').at(-1).text,goal:'Defend the research method.',constraints:[],durationMinutes:10,rubric:[{name:'Method',description:'Explain why the method fits.'}],cast:[{name:'Mira',role:'Methods examiner',reason:'Tests the research design.',code:'Evidence first.',personality:'Patient and precise'},{name:'Noor',role:'Practical reviewer',reason:'Tests whether the plan is feasible.',code:'Ask what happens next.',personality:'Practical and curious'}]});
test.beforeEach(async({page})=>{
 root=await mkdtemp(path.join(tmpdir(),'goc-guide-browser-'));calls=0;failSetup=false;lateSetup=null;
 const ai={catalog:async()=>({providers:[{id:'openai',name:'OpenAI',status:'Explicit test fixture',models:[{id:'gpt-fixture',name:'Fixture'}],audioModels:[]}],voices:[],voiceStatus:'Fixture: captions',localStatus:'Unavailable'}),validateAssignment:async()=>{},setup:async(_p:any,_c:any,s:any)=>{calls++;if(lateSetup)await lateSetup;if(failSetup){failSetup=false;throw new Error('Explicit provider failure fixture');}return {proposal:proposal(s),brain:{provider:'openai',model:'gpt-fixture-resolved'}};},speak:async()=>{throw new Error('Explicit unavailable audio fixture');}};
 const service=createSessionService({root,ai});server=http.createServer((req,res)=>void service.handle(req,res,new URL(req.url!,'http://localhost')));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`;
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:origin+url.pathname+url.search,headers:{...route.request().headers(),origin,host:new URL(origin).host}});await route.fulfill({response});});
 await page.goto('/?legacy-session=1');await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
});
test.afterEach(async()=>{await new Promise<void>(r=>{server.close(()=>r());server.closeAllConnections();});expect(path.resolve(root).startsWith(path.join(tmpdir(),'goc-guide-browser-'))).toBe(true);await rm(root,{recursive:true,force:true});});
async function send(page:Page,text:string){await page.getByLabel('Your instruction').fill(text);await page.getByRole('button',{name:'Send instruction'}).click();}
async function saved(page:Page){const profile=await page.locator('#profile-select').inputValue(),id=new URL(page.url()).searchParams.get('session');return (await(await fetch(`${origin}/api/sessions/${id}?profileId=${profile}`)).json()).session;}
async function confirm(page:Page){await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');await page.locator('[data-guide="confirm"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','cast');}

test('a sentence, corrected readback and mixed saved/new cast reach an explicitly approved setup without forms',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const profile=await page.locator('#profile-select').inputValue();let library=(await(await fetch(`${origin}/api/characters?profileId=${profile}`)).json()).library;
 const character=generateCharacter(profile);character.name='Saved researcher';
 await fetch(`${origin}/api/characters?profileId=${profile}`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),expectedRevision:library.revision,action:'create',id:character.id,character:characterFields({name:character.name,avatar:character.avatar,code:character.code,personality:character.personality,voicePreference:character.voicePreference})})});
 await page.reload();await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
 await send(page,'I’m defending my research proposal.');await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');expect((await saved(page)).guidance.notes.at(-1).status).toBe('unconfirmed');
 await page.locator('[data-guide="correct"]').click();await send(page,'Focus on my method, not the entire defence.');await confirm(page);
 await page.locator('[data-guide="saved"]').click();await page.locator(`[data-guide="reuse:${character.id}"]`).click();await expect(page.locator('.guide-receipt')).toContainText('joined');
 await page.locator('[data-guide="invite"]').click();await expect.poll(async()=>(await saved(page)).participants.filter((p:any)=>p.active).length).toBe(2);
 await page.locator('[data-guide="recap"]').click();expect((await saved(page)).status).toBe('draft');await page.locator('[data-guide="approve"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','ready');
 const s=await saved(page);expect(s.status).toBe('ready');expect(s.scenario.mode).toBe('rehearsal');expect(s.guidance.notes.filter((n:any)=>n.source==='user')).toHaveLength(2);expect(s.exchanges||[]).toHaveLength(0);
 expect(await page.locator('#draft-form').isVisible()).toBe(false);await page.reload();await expect(page.locator('body')).toHaveAttribute('data-guide-view','ready');expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/wave-4-approved-setup.png'});
});
test('selection and interruption practice record actions, resume after reload and keep optional lessons pending',async({page})=>{
 await page.locator('[data-guide="practice"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','selection');await page.reload();await expect(page.locator('body')).toHaveAttribute('data-guide-view','selection');
 await page.getByRole('button',{name:'Meet Virus',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','capture');
 await send(page,'I am defending my research proposal.');await confirm(page);await page.locator('[data-guide="recap"]').click();await page.locator('[data-guide="demo"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-demo','true');await page.locator('#interrupt').click();
 const profile=await page.locator('#profile-select').inputValue();await expect.poll(async()=>{const library=(await(await fetch(`${origin}/api/characters?profileId=${profile}`)).json()).library;return library.guideProgress.lessons.interruption;}).toBe('completed');
 const progress=(await(await fetch(`${origin}/api/characters?profileId=${profile}`)).json()).library.guideProgress;expect(progress.lessons.selection).toBe('completed');expect(progress.lessons.input).toBe('completed');expect(progress.lessons.scoring).toBe('pending');expect(progress.lessons.presenters).toBe('pending');
});
test('a lost note acknowledgement and a failed proposal retry without duplicate notes or sessions',async({page})=>{
 let lost=true;await page.route('**/api/sessions/*?*',async route=>{const input=route.request().postDataJSON();const u=new URL(route.request().url());if(lost&&input?.operation==='capture'){lost=false;await route.fetch({url:origin+u.pathname+u.search,headers:{...route.request().headers(),origin,host:new URL(origin).host}});await route.abort('failed');}else await route.fallback();});
 await send(page,'Help me prepare my research defence.');await expect(page.locator('[data-guide="retry"]')).toBeVisible();await expect(page.getByLabel('Your instruction')).toHaveValue('Help me prepare my research defence.');
 failSetup=true;await page.locator('[data-guide="retry"]').click();await expect(page.locator('[data-guide="retry"]')).toBeVisible();await page.locator('[data-guide="retry"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');
 expect((await saved(page)).guidance.notes.filter((n:any)=>n.source==='user')).toHaveLength(1);const profile=await page.locator('#profile-select').inputValue();expect((await(await fetch(`${origin}/api/sessions?profileId=${profile}`)).json()).sessions).toHaveLength(1);expect(calls).toBe(2);
});
test('a lost lesson-progress receipt retries the remaining step without reconfirming or duplicating notes',async({page})=>{
 await send(page,'Prepare a research defence.');await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');let lost=true;
 await page.route('**/api/guidance/progress?*',async route=>{const input=route.request().postDataJSON(),u=new URL(route.request().url());if(lost&&input.lesson==='input'&&input.status==='completed'){lost=false;await route.fetch({url:origin+u.pathname+u.search,headers:{...route.request().headers(),origin,host:new URL(origin).host}});await route.abort('failed');}else await route.fallback();});
 await page.locator('[data-guide="confirm"]').click();await expect(page.locator('[data-guide="retry"]')).toBeVisible();await page.locator('[data-guide="retry"]').click();await expect(page.locator('[data-guide="invite"]')).toBeVisible();
 const s=await saved(page);expect(s.guidance.notes).toHaveLength(2);expect(s.events.filter((e:any)=>e.type==='session.guidance'&&JSON.parse(e.command).operation==='confirm-notes')).toHaveLength(1);expect(calls).toBe(1);
});
test('context is extracted, paged and reviewed before inference uses it; unreadable material can be removed',async({page})=>{
 await page.locator('[data-guide="direct"]').click();await page.locator('[data-guide="context-menu"]').click();
 await page.locator('#context-file').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('The study must finish in six weeks. '.repeat(20))});await expect(page.locator('body')).toHaveAttribute('data-guide-view','context');expect(calls).toBe(0);expect((await saved(page)).guidance.setup.context[0].status).toBe('pending');
 await page.locator('[data-guide="next"]').click();await page.locator('[data-guide="review-context"]').click();await expect(page.locator('body')).toHaveAttribute('data-guide-view','capture');
 // There is no situation yet: the reviewed excerpt is saved, while no task response is fabricated.
 expect((await saved(page)).guidance.setup.context[0].status).toBe('reviewed');await send(page,'Help me discuss the six-week study.');await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');
});
test('leaving setup interrupts a late proposal and preserves captured words',async({page})=>{
 let release=()=>{};lateSetup=new Promise<void>(r=>release=r);await send(page,'A research decision.');await expect.poll(()=>calls).toBe(1);await page.getByRole('button',{name:'Settings',exact:true}).click();release();await expect(page.locator('#conversation-state')).toHaveText('Ready');await page.waitForTimeout(200);expect((await saved(page)).guidance.notes.filter((n:any)=>n.source==='interpretation')).toHaveLength(0);expect((await saved(page)).guidance.notes.filter((n:any)=>n.source==='user')).toHaveLength(1);
});
test('guide choices fit a short viewport without scrolling or overlapping the conversation dock',async({page})=>{
 await page.setViewportSize({width:900,height:600});await send(page,'A decision about my research.');await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');
 const layout=await page.evaluate(()=>{const panel=document.querySelector('#guide-setup')!.getBoundingClientRect(),dock=document.querySelector('#conversation')!.getBoundingClientRect();return{panel:{bottom:panel.bottom,right:panel.right,left:panel.left},dock:{top:dock.top,left:dock.left},height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollHeight};});expect(layout.scroll).toBeLessThanOrEqual(layout.height);expect(layout.panel.bottom).toBeLessThan(layout.dock.top);expect(layout.panel.right).toBeLessThanOrEqual(layout.width);
 await page.screenshot({path:'test-results/wave-4-short-viewport.png'});
});
test.describe('native guide introduction',()=>{test.describe.configure({timeout:150000});
 test.use({baseURL:'https://localhost:5443',ignoreHTTPSErrors:true});
 test('hands select the guide, enter a situation and confirm a ready setup without HTML forms',async({page})=>{
  const runtime=await readFile('node_modules/iwer/build/iwer.min.js','utf8');
  await page.addInitScript({content:`${runtime}\nwindow.xrDevice=new IWER.XRDevice(IWER.metaQuest3);window.xrDevice.installRuntime({forceInstall:true});window.xrDevice.primaryInputMode='hand';window.xrDevice.position.set(0,1.6,0);`});
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');await page.getByRole('button',{name:'Enter VR',exact:true}).click();
  await pinchAction(page,'guide:practice');await expect(page.locator('body')).toHaveAttribute('data-guide-view','selection');
  await pinchWorld(page,-1.75,1.6,-.85);await expect(page.locator('body')).toHaveAttribute('data-guide-view','capture');
  await pinchAction(page,'ai:type');await expect(page.locator('body')).toHaveAttribute('data-keyboard-open','true');
  for(const c of 'research')await pinchAction(page,'key:'+c);
  await pinchAction(page,'key:send');await expect(page.locator('body')).toHaveAttribute('data-guide-view','review');expect((await saved(page)).guidance.notes[0].text).toBe('research');
  await pinchAction(page,'guide:confirm');await expect(page.locator('body')).toHaveAttribute('data-guide-view','cast');await pinchAction(page,'guide:invite');await expect.poll(async()=>(await saved(page)).participants.filter((p:any)=>p.active).length).toBe(1);
  await pinchAction(page,'guide:recap');await pinchAction(page,'guide:approve');await expect(page.locator('body')).toHaveAttribute('data-guide-view','ready');await pinchAction(page,'exit');await expect(page.locator('body')).toHaveAttribute('data-xr-active','false');
 });
});
