import { test, expect, type Page } from '@playwright/test';
import { brainCommand } from '../src/brains';
import { OnboardingManager } from '../src/onboarding';
import { navigationIntent } from '../src/court-intents';

test.use({viewport:{width:960,height:720},launchOptions:{args:['--use-angle=d3d11','--autoplay-policy=no-user-gesture-required']}});
const id = 'eeeeeeee-1111-4111-8111-111111111111';
const charter = { idea:'A reading tracker for students', milestones:[{id:'m1',title:'Add books and save progress',achieved:null},{id:'m2',title:'Review reading progress',achieved:null}] };
const proposal = { id:'ffffffff-1111-4111-8111-111111111111', title:'Reading tracker',requirements:['Add books','Save progress'],status:'awaiting-approval' };
function wav(){const bytes=Buffer.alloc(44+4800);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4800,40);return bytes;}
async function fixture(page:Page, returning=false,motion: 'reduce'|'no-preference'='reduce'){
  const state:any={mode:'cloud',configured:true,selectedProvider:'gemini',provider:'Gemini',setup:{profileId:id,profileName:'Test profile',mode:'cloud',activity:'plan',workspace:null},onboarded:returning,brains:{},history:[],checks:[],charter:returning?charter:null,proposal:returning?{...proposal}:null,providers:[
    {id:'muse',name:'Muse',installed:false,state:'disabled',message:'Meta API unavailable'},
    ...['gemini','claude','codex'].map(id=>({id,name:id,installed:true,state:'connected',message:'Ready'}))
  ]};
  state.providers=state.providers.map((p:any)=>({description:'Test provider',loginCommand:'',installUrl:'https://example.test',...p}));
  let buildPolls=0;
  const requests:{path:string;body:any}[]=[];
  await page.addInitScript(()=>{
    Object.defineProperty(window,'devicePixelRatio',{value:.5});
    (window as any).SpeechRecognition=class {
      onresult:any;onend:any;onerror:any;
      start(){(window as any).__recognition=this;const text=(window as any).__transcript||(!(window as any).__heardOnce?'cloud':'');if(!text)return;(window as any).__heardOnce=true;(window as any).__transcript='';queueMicrotask(()=>{this.onresult?.({results:[[{transcript:text}]]});this.onend?.();});}
      stop(){} abort(){}
    };
  });
  await page.emulateMedia({reducedMotion:motion});
  await page.route('**/api/court/**',async route=>{
    const path=new URL(route.request().url()).pathname.split('/').at(-1)!;
    const body=route.request().method()==='POST'?route.request().postDataJSON():null;
    requests.push({path,body});
    if(path==='voice'){await route.fulfill({contentType:'audio/wav',body:wav()});return;}
    let result:any=state;
    if(path==='plan-idea'){state.charter=charter;state.proposal={...proposal};result={role:'virus',speech:'I suggest adding books first, then reviewing progress. Your milestones and plan are ready.',charter,proposal:state.proposal};}
    if(path==='brain'){
      if(body.provider==='muse'){await route.fulfill({status:503,json:{error:'Muse unavailable'}});return;}
      state.brains[body.role]=body.provider;result={...state};
    }
    if(path==='setup'){state.setup={...body};result={setup:state.setup};}
    if(path==='provider'){const provider=state.providers.find((p:any)=>p.id===body.provider);if(provider)provider.state='connected';result={...state};}
    if(path==='complete-onboarding'){state.onboarded=true;result={onboarded:true};}
    if(path==='build'){state.activeBuildRequestId=body.requestId;state.proposal.status='building';result={pending:true,requestId:body.requestId};}
    if(path==='build-status'){buildPolls++;if(state.holdBuild||buildPolls<2)result={status:'pending'};else{state.artifact={title:'Reading tracker',version:id};state.proposal.status='ready-for-review';state.activeBuildRequestId=null;result={status:'complete',result:{artifact:state.artifact,checks:[],speech:'Your reading tracker is built and ready to try.'}};}}
    if(path==='files')result={files:{'index.html':'<h1>Reading tracker</h1>','app.css':'body { color: teal; }','app.js':'console.log("reading");'}};
    if(path==='converse')result={role:body.role,speech:'A useful next step.',proposal:null};
    await route.fulfill({json:result});
  });
  await page.routeWebSocket('**/preview?**',ws=>{ws.send(JSON.stringify({type:'status',status:'ready',message:'Live browser · saved to your project'}));});
  await page.goto('/?project='+id);
  await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
  return {requests,state};
}
async function send(page:Page,text:string){await page.locator('#instruction').fill(text);await page.locator('#send-instruction').click();}

test('brain commands use head context; navigation requests remain actions',()=>{
  expect(brainCommand('cloud','virus',true)?.provider).toBe('claude');
  expect(brainCommand('Claude','builder',true)?.provider).toBe('claude');
  expect(brainCommand('cloud','virus',false)).toBeNull();
  expect(brainCommand('Use Gemini','architect')?.provider).toBe('gemini');
  expect(navigationIntent('Virus take me to the court')).toBe('court');
  expect(navigationIntent('take me to the code')).toBe('code');
  expect(navigationIntent('show me the application')).toBe('preview');
  expect(navigationIntent('Build a code editor with clouds in the background')).toBeNull();
});

test('first visit demonstrates actions, drafts milestones and introduces characters progressively',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const {requests,state}=await fixture(page);
  await expect(page.locator('[data-role="virus"]')).toHaveCount(1);
  for(const role of ['architect','builder','inspector','artiste'])await expect(page.locator(`[data-role="${role}"]`)).toBeHidden();
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','brain',{timeout:25000});
  await expect(page.locator('[data-brain="muse"]')).toBeDisabled();
  await page.locator('#microphone').click();
  await expect.poll(()=>state.brains.virus).toBe('claude');
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','gesture');
  await page.locator('#tour-continue').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','idea');
  await send(page,'A reading tracker for students');
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready',{timeout:40000});
  await expect(page.locator('#proposal-title')).toHaveText('Reading tracker');
  await expect(page.locator('#plan-milestones')).toContainText('Add books and save progress');
  for(const role of ['architect','builder','inspector','artiste'])await expect(page.locator(`[data-role="${role}"]`)).toBeVisible();
  expect(requests.filter(r=>r.path==='plan-idea')).toHaveLength(1);
  expect(requests.filter(r=>r.path==='converse')).toHaveLength(0);
  expect(state.onboarded).toBe(true);
  await page.screenshot({path:'test-results/guided-court-ready.png'});
  await page.reload();
  await expect(page.locator('#begin-reign')).toHaveText('Continue with Virus');
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready',{timeout:30000});
  expect(requests.filter(r=>r.path==='plan-idea')).toHaveLength(1);
  await send(page,'take me to court');
  await expect(page.locator('#caption')).toContainText('saved plan');
  await send(page,'approve this plan');
  await expect(page.locator('body')).toHaveClass(/is-preview/);
  await page.locator('#return-court').click();
  await send(page,'show me the code');
  await expect(page.locator('#code-dialog')).toBeVisible();
  await expect(page.locator('#code-content')).toContainText('Reading tracker');
  await page.locator('#code-file').selectOption('app.js');
  await expect(page.locator('#code-content')).toContainText('console.log');
  await page.screenshot({path:'test-results/guided-code-view.png'});
  expect(errors).toEqual([]);
});

test('unavailable Muse cannot be picked or sent to inference; settings navigation acts directly',async({page})=>{
  const {requests}=await fixture(page,true);
  await page.locator('#settings').click();
  await page.locator('#settings-brain').click();
  await expect(page.locator('[data-brain="muse"]')).toBeDisabled();
  await send(page,'use muse');
  await expect(page.locator('#toast')).toContainText('Meta API unavailable');
  expect(requests.filter(r=>r.path==='brain')).toHaveLength(0);
  await send(page,'open settings');
  await expect(page.locator('#settings-dialog')).toBeVisible();
  expect(requests.filter(r=>r.path==='converse')).toHaveLength(0);
});


test('cancelled or paused guides cannot finish onboarding behind a dialog',async()=>{
  let release:()=>void=()=>{};let completed=false;const revealed:string[]=[];
  const scene:any={clearGestureOrbs(){},openHead(){},cancelGuidance(){},async guideToCourt(){},selectCharacter(){}};
  const guide=new OnboardingManager({scene,speak:()=>new Promise<void>(r=>{release=r;}),planIdea:async()=>({speech:'Ready'}),reveal:r=>revealed.push(r),stage(){},onComplete:async()=>{completed=true;},error:message=>{throw new Error(message);}});
  const run=guide.start({returning:true,hasIdea:true});
  await Promise.resolve();await Promise.resolve();guide.pause();release();
  await Promise.resolve();await Promise.resolve();
  expect(revealed).toEqual(['virus']);expect(completed).toBe(false);
  guide.stop();await run;expect(completed).toBe(false);
});

test('VR garden lets hands continue the guide, select an orb, and reach the keyboard',async({page})=>{
  test.setTimeout(90000);
  const { readFile }=await import('node:fs/promises');
  const runtime=await readFile('node_modules/iwer/build/iwer.min.js','utf8');
  await page.addInitScript({content:`${runtime}\nwindow.xrDevice = new IWER.XRDevice(IWER.metaQuest3); window.xrDevice.installRuntime({forceInstall:true}); window.xrDevice.primaryInputMode='hand'; window.xrDevice.position.set(0,1.6,0);`});
  const {state}=await fixture(page);state.setup=null;await page.reload();
  await page.locator('#enter-vr').click();
  await expect(page.locator('body')).toHaveClass(/in-vr/);
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','setup');
  const pinch=async(x:number,y:number,z:number)=>{
    await page.evaluate(({x,y,z})=>{
      const hand=(window as any).xrDevice.hands.right;hand.position.set(.25,1.3,-.4);
      const dx=x-.25,dy=y-1.3,dz=z-5.1,length=Math.hypot(dx,dy,dz);
      const vx=dx/length,vy=dy/length,vz=dz/length,w=1-vz,ql=Math.hypot(vy,-vx,w);
      hand.quaternion.set(vy/ql,-vx/ql,0,w/ql);
    },{x,y,z});
    await page.waitForTimeout(180);
    await page.evaluate(()=>(window as any).xrDevice.hands.right.updatePinchValue(1));
    await page.waitForTimeout(180);
    await page.evaluate(()=>(window as any).xrDevice.hands.right.updatePinchValue(0));
    await page.waitForTimeout(180);
  };
  const panel=async(x:number,y:number,composer=false)=>{
    const lx=(x/1400-.5)*2.65,ly=(.5-y/600)*1.136;
    await pinch(lx,(composer?1.3:1)+ly*Math.cos(-.13),(composer?3.8:3.65)+ly*Math.sin(-.13));
  };
  await panel(1028,312); // Profile: Continue.
  await panel(368,312); // Cloud mode.
  await panel(1028,312); // Plan an idea.
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','brain');
  await panel(1132,382);
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','gesture');
  await pinch(0,1.85,3.4);
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','idea');
  await panel(685,382);
  await panel(806,340,true);await panel(974,274,true);
  await expect(page.locator('#instruction')).toHaveValue('hi');
  await panel(250,556,true);
  await page.evaluate(()=>(window as any).__transcript='open settings');
  await panel(253,382);
  await expect(page.locator('body')).toHaveAttribute('data-settings-open','true');
  await panel(1132,482);
  await expect(page.locator('body')).toHaveAttribute('data-settings-open','false');
  await panel(1190,489);
  await expect(page.locator('body')).not.toHaveClass(/in-vr/);
});


test('reloading during a background build reconnects and opens the finished application',async({page})=>{
  const {state,requests}=await fixture(page,true);state.holdBuild=true;
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready');
  await send(page,'approve this plan');
  await expect.poll(()=>requests.filter(r=>r.path==='build-status').length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#caption')).toContainText('reconnecting');
  state.holdBuild=false;
  await expect(page.locator('body')).toHaveClass(/is-preview/);
  expect(requests.filter(r=>r.path==='build')).toHaveLength(1);
});


test('startup paints useful text and rotates quotes even when the 3D module fails',async({page})=>{
  await page.route('**/src/court-main.ts*',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('#boot-screen')).toBeVisible();
  await expect(page.locator('#boot-retry')).toBeVisible();
  const first=await page.locator('#boot-quote').textContent();
  await expect(page.locator('#boot-quote')).not.toHaveText(first!);
});

test('desktop arrival can be skipped and leaves a compact garden entry',async({page})=>{
  await fixture(page,false,'no-preference');
  await expect(page.locator('body')).toHaveAttribute('data-cinematic','true');
  await page.screenshot({path:'test-results/castle-arrival.png'});
  await page.locator('#skip-arrival').click();
  await expect(page.locator('body')).toHaveAttribute('data-cinematic','false');
  await expect(page.locator('#begin-reign')).toBeVisible();
  await expect(page.locator('.conversation')).toBeHidden();
});

test('hands-free rearms between turns, pauses for voice and stops explicitly',async({page})=>{
  const {requests}=await fixture(page,true);
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready');
  await page.evaluate(()=>{
    (window as any).__starts=0;
    (window as any).SpeechRecognition=class {
      onresult:any;onend:any;onerror:any;
      start(){(window as any).__starts++;(window as any).__recognition=this;}
      stop(){this.onend?.();} abort(){}
    };
  });
  await page.locator('#hands-free').click();
  await expect(page.locator('#hands-free')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>(window as any).__starts)).toBe(1);
  let release:()=>void=()=>{};
  const gate=new Promise<void>(r=>release=r);
  await page.route('**/api/court/voice',async route=>{await gate;await route.fulfill({contentType:'audio/wav',body:wav()});});
  await page.evaluate(()=>{const r=(window as any).__recognition;r.onresult({results:[[{transcript:'Please suggest a useful improvement'}]]});r.onend();});
  await expect.poll(()=>requests.filter(r=>r.path==='converse').length).toBe(1);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(()=>(window as any).__starts)).toBe(1);
  release();
  await expect.poll(()=>page.evaluate(()=>(window as any).__starts)).toBe(2);
  await page.locator('#hands-free').click();
  await page.waitForTimeout(1200);
  expect(await page.evaluate(()=>(window as any).__starts)).toBe(2);
  await expect(page.locator('#hands-free')).toHaveAttribute('aria-pressed','false');
});

test('approval collapses the plan, shows elapsed work, and opens preview before narration',async({page})=>{
  const {state}=await fixture(page,true);state.holdBuild=true;
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready');
  await page.locator('#approve-plan').click();
  await expect(page.locator('#proposal-card')).toBeHidden();
  await expect(page.locator('#work-status')).toBeVisible();
  await expect(page.locator('#work-stage')).toContainText('Writing your application');
  await expect(page.locator('#work-elapsed')).toContainText('s');
  await page.screenshot({path:'test-results/build-progress.png'});
  await page.route('**/api/court/voice',route=>route.abort());
  state.holdBuild=false;
  await expect(page.locator('body')).toHaveClass(/is-preview/);
});


test('denied microphone permission turns hands-free off without retrying',async({page})=>{
  await fixture(page,true);
  await page.locator('#begin-reign').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready');
  await page.evaluate(()=>{
    (window as any).__starts=0;
    (window as any).SpeechRecognition=class {
      onerror:any;start(){(window as any).__starts++;queueMicrotask(()=>this.onerror?.({error:'not-allowed'}));}abort(){}
    };
  });
  await page.locator('#hands-free').click();
  await expect(page.locator('#toast')).toContainText('denied');
  await expect(page.locator('#hands-free')).toHaveAttribute('aria-pressed','false');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(()=>(window as any).__starts)).toBe(1);
});


test('Virus asks profile and execution mode, hands off local honestly, and lets users explore without a build',async({page})=>{
  test.setTimeout(100000);
  const {state,requests}=await fixture(page);state.setup=null;await page.reload();
  await page.locator('#begin-reign').click();
  await expect(page.locator('#setup-title')).toHaveText('Who is taking the throne?');
  await page.locator('#setup-name').fill('Sourabh');
  await page.locator('[data-setup="profile-next"]').click();
  await expect(page.locator('#setup-title')).toHaveText('Where shall we work?');
  await page.locator('[data-setup="local"]').click();
  await expect(page.locator('#setup-title')).toHaveText('Open your computer court');
  await expect(page.locator('#court-setup a')).toHaveAttribute('href','http://localhost:5173/');
  await expect(page.locator('#session-context')).toContainText('Cloud');
  expect(requests.filter(r=>r.path==='setup')).toHaveLength(0);
  await page.locator('[data-setup="stay"]').click();
  await page.locator('[data-setup="explore"]').click();
  await expect(page.locator('#session-context')).toHaveText('Cloud · Sourabh');
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','brain');
  await page.locator('#tour-continue').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','gesture');
  await page.locator('#tour-continue').click();
  await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready',{timeout:30000});
  await expect(page.locator('#caption')).toContainText('explore');
  await page.locator('[data-role="virus"]').click();await send(page,'Hello, tell me about the court');
  await expect.poll(()=>requests.filter(r=>r.path==='converse').length).toBe(1);
  expect(requests.filter(r=>['plan-idea','build'].includes(r.path))).toHaveLength(0);
  expect(state.setup.activity).toBe('explore');
  await page.reload();await expect(page.locator('#session-context')).toHaveText('Cloud · Sourabh');
});

test('cloud brain swapping never asks for local account sign-in',async({page})=>{
  const {state}=await fixture(page,true);state.providers.find((p:any)=>p.id==='codex').state='not-checked';await page.reload();
  await page.locator('#settings').click();await page.locator('#settings-brain').click();
  await page.locator('[data-brain="codex"]').click();
  await expect(page.locator('#caption')).toContainText('server API is configured');
  await expect(page.locator('#caption')).not.toContainText('sign-in');
  await page.locator('#settings').click();await page.locator('#connect-provider').click();
  await expect(page.locator('#provider-intro')).toContainText('server-managed APIs');
  await expect(page.locator('.provider-command')).toHaveCount(0);
});

test('the table stages construction while the real build runs',async({page})=>{
  const {state}=await fixture(page,true);state.holdBuild=true;
  await page.locator('#begin-reign').click();await expect(page.locator('body')).toHaveAttribute('data-tour-stage','ready');
  await page.locator('#approve-plan').click();
  await expect(page.locator('body')).toHaveAttribute('data-construction-stage','generating');
  await page.screenshot({path:'test-results/table-construction.png'});
  state.holdBuild=false;await expect(page.locator('body')).toHaveClass(/is-preview/);
  await expect(page.locator('body')).toHaveAttribute('data-construction-stage','idle');
});


test('local setup guides CLI sign-in and requires a verified account and workspace',async({page})=>{
  const {state,requests}=await fixture(page);state.setup=null;state.mode='local';
  state.providers.forEach((p:any)=>{p.state=p.id==='gemini'?'disabled':'not-checked';p.installed=p.id==='codex'||p.id==='claude';p.loginCommand=p.id==='codex'?'codex login':'claude';});
  await page.reload();await page.locator('#begin-reign').click();
  await page.locator('#setup-name').fill('Work');await page.locator('[data-setup="profile-next"]').click();
  await page.locator('[data-setup="local"]').click();
  await expect(page.locator('#setup-title')).toHaveText('Connect your local assistants');
  await expect(page.locator('#court-setup')).toContainText('codex login');
  await page.locator('#setup-workspace').fill('D:\\projects\\work');
  await page.locator('[data-setup="providers-next"]').click();
  await expect(page.locator('#setup-error')).toContainText('Verify at least one');
  await page.locator('[data-setup="check:codex"]').click();
  await expect(page.locator('#court-setup')).toContainText('Verified');
  await page.locator('[data-setup="providers-next"]').click();await page.locator('[data-setup="explore"]').click();
  await expect(page.locator('#session-context')).toHaveText('Local · Work');
  expect(requests.find(r=>r.path==='setup')?.body.workspace).toBe('D:\\projects\\work');
  expect(requests.some(r=>r.path==='provider'&&r.body.provider==='codex')).toBe(true);
});


test('cancelled local connection checks cannot reopen or overwrite a new setup wizard',async({page})=>{
  const {state}=await fixture(page);state.setup=null;state.mode='local';await page.reload();
  await page.locator('#begin-reign').click();await page.locator('[data-setup="profile-next"]').click();await page.locator('[data-setup="local"]').click();
  let release:()=>void=()=>{};const gate=new Promise<void>(r=>release=r);
  await page.route('**/api/court/provider',async route=>{await gate;await route.fulfill({json:state});});
  await page.locator('[data-setup="check:codex"]').click();
  await page.locator('[data-setup="cancel"]').click();await expect(page.locator('#court-setup')).toBeHidden();
  await page.locator('#begin-reign').click();await expect(page.locator('#setup-title')).toHaveText('Who is taking the throne?');
  release();await page.waitForTimeout(700);
  await expect(page.locator('#setup-title')).toHaveText('Who is taking the throne?');
});
