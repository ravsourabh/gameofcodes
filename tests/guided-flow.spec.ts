import { test, expect, type Page } from '@playwright/test';
import { brainCommand } from '../src/brains';
import { OnboardingManager } from '../src/onboarding';
import { navigationIntent } from '../src/court-intents';

test.use({viewport:{width:960,height:720},launchOptions:{args:['--use-angle=d3d11','--autoplay-policy=no-user-gesture-required']}});
const id = 'eeeeeeee-1111-4111-8111-111111111111';
const charter = { idea:'A reading tracker for students', milestones:[{id:'m1',title:'Add books and save progress',achieved:null},{id:'m2',title:'Review reading progress',achieved:null}] };
const proposal = { id:'ffffffff-1111-4111-8111-111111111111', title:'Reading tracker',requirements:['Add books','Save progress'],status:'awaiting-approval' };
function wav(){const bytes=Buffer.alloc(44+4800);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4800,40);return bytes;}
async function fixture(page:Page, returning=false){
  const state:any={mode:'cloud',configured:true,selectedProvider:'gemini',provider:'Gemini',onboarded:returning,brains:{},history:[],checks:[],charter:returning?charter:null,proposal:returning?{...proposal}:null,providers:[
    {id:'muse',name:'Muse',installed:false,state:'disabled',message:'Meta API unavailable'},
    ...['gemini','claude','codex'].map(id=>({id,name:id,installed:true,state:'connected',message:'Ready'}))
  ]};
  state.providers=state.providers.map((p:any)=>({description:'Test provider',loginCommand:'',installUrl:'https://example.test',...p}));
  const requests:{path:string;body:any}[]=[];
  await page.addInitScript(()=>{
    Object.defineProperty(window,'devicePixelRatio',{value:.5});
    (window as any).SpeechRecognition=class {
      onresult:any;onend:any;onerror:any;
      start(){queueMicrotask(()=>{this.onresult?.({results:[[{transcript:(window as any).__transcript||'cloud'}]]});this.onend?.();});}
      stop(){} abort(){}
    };
  });
  await page.emulateMedia({reducedMotion:'reduce'});
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
    if(path==='complete-onboarding'){state.onboarded=true;result={onboarded:true};}
    if(path==='build'){state.artifact={title:'Reading tracker',version:id};state.proposal.status='ready-for-review';result={artifact:state.artifact,checks:[],speech:'Your reading tracker is built and ready to try.'};}
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
  await expect(page.locator('[data-role="virus"]')).toBeVisible();
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
  await page.locator('#open-head').click();
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
