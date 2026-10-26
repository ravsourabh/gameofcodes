import {leaveGuide} from './fixtures/desktop';
import{test,expect,type Page}from'@playwright/test';
import{randomUUID}from'node:crypto';
import type{Session}from'../shared/session-domain.mjs';
async function prepare(page:Page){
 let assigned:Session;
 await page.route('**/api/ai/catalog',r=>r.fulfill({json:{providers:[{id:'openai',name:'OpenAI',status:'Explicit test fixture',models:[{id:'gpt-test',name:'Fixture'}],audioModels:[]}],voices:[{provider:'openai',id:'alloy',name:'Alloy'}],voiceStatus:'Fixture',localStatus:'Unavailable'}}));
 await page.route('**/api/ai/assign?*',async r=>{const input=r.request().postDataJSON(),profile=new URL(r.request().url()).searchParams.get('profileId');const response=await page.request.get(`/api/sessions/${input.sessionId}?profileId=${profile}`);assigned=structuredClone((await response.json()).session);assigned.guidance!.guide!.brain=input.brain;assigned.guidance!.guide!.voice=input.voice;await r.fulfill({json:{session:assigned}});});
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
 await leaveGuide(page);
 return(input:any,text:string)=>{const s=structuredClone(assigned),at=new Date().toISOString();s.exchanges=[{id:randomUUID(),requestId:input.requestId,characterId:input.characterId,userText:input.text,text,brain:{provider:'openai',model:'gpt-test-resolved'},epoch:s.epoch,at}];s.revision++;s.updatedAt=at;s.events.push({schemaVersion:1,id:randomUUID(),requestId:input.requestId,sequence:s.revision,type:'session.exchange',at,epoch:s.epoch,command:JSON.stringify({action:'talk',characterId:input.characterId,text:input.text})});return s;};
}
test('a voice failure preserves the attributed reply and repeat remains available',async({page})=>{
 const result=await prepare(page);
 await page.route('**/api/ai/talk?*',r=>r.fulfill({json:{session:result(r.request().postDataJSON(),'Consider what evidence would change the decision.')}}));
 await page.route('**/api/ai/speech?*',r=>r.fulfill({status:503,json:{error:'Explicit unavailable voice fixture'}}));
 await page.getByLabel('Your instruction').fill('What should I consider?');await page.getByRole('button',{name:'Send instruction'}).click();
 await expect(page.locator('#conversation-state')).toHaveText('Voice unavailable');await expect(page.locator('#conversation-caption')).toContainText('evidence');await expect(page.getByLabel('Your instruction')).toHaveValue('');
 await page.getByRole('button',{name:'Repeat',exact:true}).click();await expect(page.locator('#conversation-state')).toHaveText('Voice unavailable');await expect(page.locator('#conversation-caption')).toContainText('evidence');
});
test('interrupt rejects a late browser reply and never starts its speech',async({page})=>{
 const result=await prepare(page);let release=()=>{},started=()=>{};const gate=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>started=r);let speech=0;
 await page.route('**/api/ai/talk?*',async r=>{const s=result(r.request().postDataJSON(),'A late reply that must not appear.');started();await gate;try{await r.fulfill({json:{session:s}});}catch{}});
 await page.route('**/api/ai/speech?*',r=>{speech++;return r.fulfill({status:503,json:{error:'No audio expected'}});});
 await page.getByLabel('Your instruction').fill('Think about this');await page.getByRole('button',{name:'Send instruction'}).click();await arrived;
 await page.getByRole('button',{name:'Interrupt',exact:true}).click();await expect(page.locator('#conversation-state')).toHaveText('Ready');release();await page.waitForTimeout(250);
 await expect(page.locator('#conversation-caption')).not.toContainText('late reply');expect(speech).toBe(0);
});

test('direct brain and voice commands open controls without inference or creating a session',async({page})=>{
 await prepare(page);let modelCalls=0;
 for(const action of ['talk','avatar'])await page.route(`**/api/ai/${action}?*`,r=>{modelCalls++;return r.fulfill({status:500,json:{error:'A UI command must not use inference'}});});
 await page.getByLabel('Your instruction').fill('Virus, can you please open your brain?');await page.getByRole('button',{name:'Send instruction'}).click();
 await expect(page.locator('#characters-dialog')).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-workshop-view','brain');await expect(page.locator('[data-workshop="brain"]')).toHaveAttribute('aria-pressed','true');
 expect(new URL(page.url()).searchParams.has('session')).toBe(false);expect(modelCalls).toBe(0);
 await page.locator('[data-workshop="close"]').click();await page.getByLabel('Your instruction').fill('Show me your voice settings.');await page.getByRole('button',{name:'Send instruction'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-workshop-view','voice');expect(modelCalls).toBe(0);
 await page.locator('[data-workshop="close"]').click();await page.getByRole('button',{name:'Characters',exact:true}).click();await page.getByRole('button',{name:'New character'}).click();const name=await page.locator('.workshop-top h2').textContent();
 await page.getByLabel('Your instruction').fill('Open my brain');await page.getByRole('button',{name:'Send instruction'}).click();await expect(page.locator('body')).toHaveAttribute('data-workshop-view','brain');await expect(page.locator('.workshop-top h2')).toHaveText(name!);expect(modelCalls).toBe(0);
});

test('a brain command interrupts the current reply before opening its controls',async({page})=>{
 const result=await prepare(page);let release=()=>{},started=()=>{};const gate=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>started=r);let calls=0,speech=0;
 await page.route('**/api/ai/talk?*',async r=>{calls++;const s=result(r.request().postDataJSON(),'A late reply that must not appear.');started();await gate;try{await r.fulfill({json:{session:s}});}catch{}});
 await page.route('**/api/ai/speech?*',r=>{speech++;return r.fulfill({status:503,json:{error:'No audio expected'}});});
 await page.getByLabel('Your instruction').fill('Think about this');await page.getByRole('button',{name:'Send instruction'}).click();await arrived;
 await page.getByLabel('Your instruction').fill('Open your brain');await page.getByRole('button',{name:'Send instruction'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-workshop-view','brain');await expect(page.locator('#conversation-state')).toHaveText('Ready');release();await page.waitForTimeout(250);
 await expect(page.locator('#conversation-caption')).not.toContainText('late reply');expect(calls).toBe(1);expect(speech).toBe(0);
});

test('summary and guide actions remain separated in a short zoomed viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:560},deviceScaleFactor:1.5});const page=await context.newPage();
 try{await prepare(page);await page.getByRole('button',{name:'Discuss a problem'}).click();
 const layout=await page.evaluate(()=>{const details=document.querySelector('#edit-details')!.getBoundingClientRect(),back=document.querySelector('#summary-home')!.getBoundingClientRect(),meet=document.querySelector('#meet-guide')!.getBoundingClientRect(),customise=document.querySelector('#customise-guide')!.getBoundingClientRect();return{summaryDisplay:getComputedStyle(document.querySelector('.summary-actions')!).display,summaryGap:back.left-details.right,guideGap:customise.top>=meet.bottom?customise.top-meet.bottom:customise.left-meet.right,scrollHeight:document.documentElement.scrollHeight,height:innerHeight};});
 expect(layout.summaryDisplay).toBe('flex');expect(layout.summaryGap).toBeGreaterThanOrEqual(10);expect(layout.guideGap).toBeGreaterThanOrEqual(10);expect(layout.scrollHeight).toBeLessThanOrEqual(layout.height);
 await page.screenshot({path:'test-results/action-spacing-fixed.png'});
 }finally{await context.close();}
});
