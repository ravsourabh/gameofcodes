import {pinchAction} from './fixtures/xr';
import {leaveGuide} from './fixtures/desktop';
import {test,expect,type Page}from'@playwright/test';
import {readFile}from'node:fs/promises';
import {generateCharacter,characterFields}from'../shared/character-domain.mjs';
const emptyCatalog={providers:[],voices:[],voiceStatus:'No cloud voice configured',localStatus:'Not connected'};
async function library(page:Page){const profile=await page.locator('#profile-select').inputValue();return(await(await page.request.get(`/api/characters?profileId=${profile}`)).json()).library;}
async function openNew(page:Page){await page.getByRole('button',{name:'Characters',exact:true}).click();await page.getByRole('button',{name:'New character'}).click();}
test.beforeEach(async({page})=>{await page.route('**/api/ai/catalog',route=>route.fulfill({json:emptyCatalog}));});
test('entry and workshop fit the viewport with no scrolling or appearance forms',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?legacy-session=1');await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
 for(const size of [{width:1280,height:720},{width:900,height:600}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:1280,height:720});await openNew(page);expect(await page.locator('#characters-dialog select').count()).toBe(0);expect(await page.locator('#characters-dialog').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
 await page.screenshot({path:'test-results/wave-3-workshop.png'});expect(errors).toEqual([]);
});
test('visual choices, keep and one Join action persist one reusable character',async({page})=>{
 await page.goto('/?legacy-session=1');const before=await library(page);await openNew(page);const size=page.viewportSize()!,scale=size.height/(2*Math.tan(55*Math.PI/360)*(2.5-.18));await page.mouse.click(size.width/2-.75*scale,size.height/2-(1.64-1.3)*scale);await expect(page.locator('body')).toHaveAttribute('data-workshop-feature','model');await page.getByRole('button',{name:'Elena',exact:true}).click();await page.getByRole('button',{name:'Keep this',exact:true}).click();await page.getByRole('button',{name:'Shuffle look'}).click();await expect(page.getByRole('button',{name:'Elena',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Rename character'}).click();await page.getByLabel('name',{exact:true}).fill('Noor');await page.locator('.identity-edit').getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('button',{name:'Join the room'}).click();await expect(page.locator('#characters-dialog')).not.toBeVisible();const after=await library(page);expect(after.characters).toHaveLength(before.characters.length+1);const character=after.characters.find((c:any)=>c.name==='Noor');expect(character.avatar.realistic.modelId).toBe('Business_Female_01');
 await expect(page.locator('body')).toHaveAttribute('data-visible-characters','2');await page.reload();await expect(page.locator('body')).toHaveAttribute('data-visible-characters','2');
 expect((await library(page)).characters.find((c:any)=>c.id===character.id)).toEqual(character);
});
test('unaccepted previews do not fill the library and a lost Join acknowledgement is retryable',async({page})=>{
 await page.goto('/?legacy-session=1');const before=await library(page);await openNew(page);await page.getByRole('button',{name:'New character'}).click();await page.getByRole('button',{name:'New character'}).click();expect((await library(page)).revision).toBe(before.revision);
 let lose=true;await page.route('**/api/characters?*',async route=>{if(route.request().method()!=='POST'||!lose)return route.continue();lose=false;await route.fetch();await route.abort('failed');});
 await page.getByRole('button',{name:'Join the room'}).click();await expect(page.locator('.character-feedback')).not.toHaveText('');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('#characters-dialog')).not.toBeVisible();expect((await library(page)).characters).toHaveLength(before.characters.length+1);
});
test('a typed AI description changes the preview and keeps locked attributes',async({page})=>{
 await page.unroute('**/api/ai/catalog');await page.route('**/api/ai/catalog',route=>route.fulfill({json:{...emptyCatalog,providers:[{id:'openai',name:'OpenAI',status:'Test fixture',models:[{id:'gpt-test',name:'Fixture'}],audioModels:[]}]}}));
 await page.goto('/?legacy-session=1');await openNew(page);await page.getByRole('button',{name:'Elena',exact:true}).click();await page.getByRole('button',{name:'Keep this',exact:true}).click();
 const profile=await page.locator('#profile-select').inputValue(),character=generateCharacter(profile,{seed:21});character.name='Mira';character.avatar.realistic={modelId:'Business_Male_04'};
 await page.route('**/api/ai/avatar?*',route=>route.fulfill({json:{fields:characterFields(Object.fromEntries(['name','avatar','personality','code','voicePreference'].map(k=>[k,character[k as keyof typeof character]]))),brain:{provider:'openai',model:'gpt-test'}}}));
 await page.getByLabel('Your instruction').fill('A researcher with glasses');await page.getByRole('button',{name:'Send instruction'}).click();await expect(page.locator('.workshop-top h2')).toContainText('Mira');await expect(page.getByRole('button',{name:'Elena',exact:true})).toHaveAttribute('aria-pressed','true');expect((await library(page)).characters).toHaveLength(1);
});
test.describe('Quest avatar workshop',()=>{test.describe.configure({timeout:150000});test.use({baseURL:'https://localhost:5443',ignoreHTTPSErrors:true});test('native hand rays create, change and join an avatar with no save form',async({page})=>{
 const runtime=await readFile('node_modules/iwer/build/iwer.min.js','utf8');await page.addInitScript({content:`${runtime}\nwindow.xrDevice=new IWER.XRDevice(IWER.metaQuest3);window.xrDevice.installRuntime({forceInstall:true});window.xrDevice.primaryInputMode='hand';window.xrDevice.position.set(0,1.6,0);`});await page.goto('/?legacy-session=1');await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');await leaveGuide(page);await page.getByRole('button',{name:'Enter VR',exact:true}).click();

 await pinchAction(page,'characters');await pinchAction(page,'workshop:new');await expect(page.locator('body')).toHaveAttribute('data-workshop-feature','model');await pinchAction(page,'workshop:choice:Male_Adult_05');await pinchAction(page,'workshop:join');await expect(page.locator('body')).toHaveAttribute('data-workshop-open','false');await expect(page.locator('body')).toHaveAttribute('data-visible-characters','2');expect((await library(page)).characters[1].avatar.realistic.modelId).toBe('Male_Adult_05');
 await pinchAction(page,'ai:type');await expect(page.locator('body')).toHaveAttribute('data-keyboard-open','true');await pinchAction(page,'key:a');await pinchAction(page,'key:cancel');await expect(page.locator('body')).toHaveAttribute('data-keyboard-open','false');await pinchAction(page,'exit');await expect(page.locator('body')).toHaveAttribute('data-xr-active','false');

});});
