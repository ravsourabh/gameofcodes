import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const project = randomUUID();
const ready = (page: Page) => expect(page.locator('#connection-status')).toHaveText('Live browser · saved to your project', { timeout: 35_000 });
const inspectProject = async (id: string): Promise<{ tasks: { title: string; status: string; priority: string }[] }> => {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:5173/preview?project=${id}`, { origin: 'http://localhost:5173' });
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Project export timed out')); }, 20_000);
    ws.on('error', reject);
    ws.on('message', (raw, binary) => {
      if (binary) return;
      const message = JSON.parse(raw.toString());
      if (message.type === 'status' && message.status === 'ready') ws.send(JSON.stringify({ type: 'export' }));
      if (message.type === 'export') { clearTimeout(timeout); ws.close(); resolve(message.data); }
    });
  });
};

// Project a known application coordinate into the desktop camera. The resulting
// real pointer action traverses raycasting, WS, browser input, and the frame stream.
async function surfaceClick(page: Page, x: number, y: number) {
  const canvas = await page.locator('#world').boundingBox();
  if (!canvas) throw new Error('Court canvas is missing');
  const distance = 1.9 - (-1.8 + 0.043);
  const halfHeight = Math.tan(48 * Math.PI / 360) * distance;
  const worldX = -1.6 + x / 1280 * 3.2;
  const worldY = 1.83 + 1 - y / 800 * 2;
  await page.mouse.click(canvas.x + canvas.width / 2 + worldX / halfHeight * canvas.height / 2,
    canvas.y + canvas.height / 2 - (worldY - 1.72) / halfHeight * canvas.height / 2);
}

test('task board supports hand keyboard, editing, filtering and persistence', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/?keyboard=1');
  await page.getByRole('button', { name: 'New task', exact: false }).click();
  for (const key of ['v', 'r']) await page.locator('#keyboard').getByRole('button', { name: key, exact: true }).click();
  await expect(page.locator('#title')).toHaveValue('vr');
  await page.locator('#priorities').getByRole('button', { name: 'Urgent' }).click();
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('button', { name: 'Move vr to In progress', exact: true }).click();
  await page.reload();
  await expect(page.locator('.progress').getByRole('button', { name: 'vr', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All priorities' }).click();
  await expect(page.getByRole('button', { name: 'Sketch the first idea', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'vr', exact: true }).click();
  await page.locator('#title').fill('A refined idea');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'A refined idea', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: false }).click();
  await expect(page.locator('#activity')).toContainText('Updated “A refined idea”');
});

test('desktop surface routes real browser input and recovers after reconnect', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/?project=${project}&view=preview`); await ready(page);
  expect(new URL(page.url()).protocol).toBe('http:');
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  await surfaceClick(page, 1140, 169);
  await expect.poll(async () => await page.locator('#latency').textContent()).not.toBe('—');
  await page.keyboard.type('Made through the 3D surface', { delay: 40 });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await inspectProject(project)).tasks.some(t => t.title === 'Made through the 3D surface')).toBe(true);
  await page.locator('#reload').click();
  await expect.poll(async () => (await inspectProject(project)).tasks.some(t => t.title === 'Made through the 3D surface')).toBe(true);
  await context.setOffline(true);
  await expect(page.locator('#reconnect')).toBeVisible();
  await page.locator('#reconnect').click();
  await context.setOffline(false);
  await ready(page);
  expect((await inspectProject(project)).tasks.some(t => t.title === 'Made through the 3D surface')).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/desktop-court.png' });
});

test('field guide, export, and headset fallback work', async ({ page }) => {
  await page.goto(`/?project=${project}&view=preview`); await ready(page);
  await page.getByRole('button', { name: 'Court settings', exact: true }).click();
  await page.getByRole('button', { name: 'How to direct your court' }).click();
  await expect(page.getByRole('heading', { name: 'Meet your court.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my court' }).click();
  await page.getByRole('button', { name: 'Court settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export starter task data' }).click();
  expect((await download).suggestedFilename()).toBe('sovereign-task-board.json');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Enter VR', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Step inside with Quest.' })).toBeVisible();
});

test('the court opens on characters, and selection produces real spoken introductions', async ({page}) => {
  test.setTimeout(100_000);
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/?project=${randomUUID()}`);
  await expect(page.locator('#caption')).toContainText('Elara');
  await expect(page.locator('#connection-status')).not.toBeVisible();
  const audio=page.waitForResponse(response=>response.url().endsWith('/api/court/voice'));
  await page.getByRole('button',{name:'Meet your court',exact:false}).click();
  const response=await audio;expect(response.status()).toBe(200);const bytes=await response.body(); expect(bytes.subarray(0,4).toString()).toBe('RIFF');
  await expect(page.locator('body')).toHaveClass(/character-speaking/);
  await page.getByRole('button',{name:'Bram builder',exact:false}).click();
  await expect(page.locator('#speaker-name')).toContainText('BRAM');
  await expect(page.locator('#caption')).toContainText('Bram');
  await page.getByRole('button',{name:'Mute character voices',exact:true}).click();
  await expect(page.locator('body')).not.toHaveClass(/character-speaking/);
  await page.screenshot({path:'test-results/character-court.png'});
  expect(errors).toEqual([]);
});

test('free-form dialogue reports the missing provider instead of inventing a response', async ({page}) => {
  await page.route('**/api/court/status?*',route=>route.fulfill({json:{configured:false,history:[],checks:[],proposal:null}}));
  await page.goto(`/?project=${randomUUID()}`);
  await page.getByRole('textbox',{name:'Your instruction',exact:true}).fill('Build a reading tracker for my books');
  await page.getByRole('button',{name:'Send instruction',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Choose your assistant.',exact:true})).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('#caption')).toContainText('not set up yet');
});

test('connected dialogue presents an actual service reply and versioned approval', async ({page}) => {
  await page.route('**/api/court/status?*',route=>route.fulfill({json:{configured:true,selectedProvider:'codex',provider:'ChatGPT · Codex',providers:[{id:'codex',name:'ChatGPT · Codex',state:'connected',installed:true,description:'Local assistant',message:'Verified',loginCommand:'codex login',installUrl:'https://learn.chatgpt.com/docs/cli'}],history:[],checks:[],proposal:null}}));
  let instruction='';
  await page.route('**/api/court/converse',route=>{instruction=route.request().postDataJSON().message;return route.fulfill({json:{role:'architect',speech:'Let’s make a reading tracker with your book list and reading status.',proposal:{id:randomUUID(),title:'Your reading tracker',requirements:['Add books','Track reading status','Save your list'],status:'awaiting-approval'}}});});
  await page.goto(`/?project=${randomUUID()}`);
  await expect(page.locator('#provider-button')).toHaveText('ChatGPT · Codex connected');
  await page.getByRole('textbox',{name:'Your instruction',exact:true}).fill('Build a reading tracker');
  await page.getByRole('button',{name:'Send instruction',exact:true}).click();
  await expect(page.locator('#proposal-title')).toHaveText('Your reading tracker');
  await expect(page.locator('#caption')).toContainText('reading tracker');
  expect(instruction).toBe('Build a reading tracker');
  await expect(page.getByRole('button',{name:'Approve this plan',exact:false})).toBeVisible();
});

test('assistant setup selects all three local CLIs and distinguishes installed from verified',async({page})=>{
  let selectedProvider='muse',verified='';const actions:{provider:string;action:string}[]=[];
  const state=()=>({configured:selectedProvider!=='muse',selectedProvider,provider:selectedProvider,history:[],checks:[],proposal:null,providers:[{id:'muse',name:'Muse Code',installed:false},{id:'codex',name:'ChatGPT · Codex',installed:true},{id:'claude',name:'Claude Code',installed:true}].map(provider=>({...provider,state:verified===provider.id?'connected':provider.installed?'not-checked':'not-installed',message:provider.installed?'Installed. Sign in in the CLI.':'Install Muse Code.',description:'Official local assistant',loginCommand:provider.id==='codex'?'codex login':provider.id==='claude'?'claude auth login':'muse',installUrl:'https://dev.meta.ai/docs/muse-code'}))});
  await page.route('**/api/court/status*',route=>route.fulfill({json:state()}));
  await page.route('**/api/court/provider',route=>{const input=route.request().postDataJSON();actions.push(input);if(input.action==='select')selectedProvider=input.provider;else verified=input.provider;return route.fulfill({json:state()});});
  await page.goto(`/?project=${randomUUID()}`);
  await page.locator('#provider-button').click();
  await expect(page.getByRole('heading',{name:'Choose your assistant.'})).toBeVisible();
  await expect(page.locator('.provider-card')).toHaveCount(3);await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const codex=page.locator('.provider-card').filter({has:page.getByRole('heading',{name:'ChatGPT · Codex'})});
  await codex.getByRole('button',{name:'Use this assistant'}).click();
  await expect(page.locator('#provider-button')).toHaveText('ChatGPT · Codex selected');
  await codex.getByRole('button',{name:'Check connection'}).click();
  await expect(codex.locator('.provider-badge')).toHaveText('Verified');
  const claude=page.locator('.provider-card').filter({has:page.getByRole('heading',{name:'Claude Code',exact:true})});
  await claude.getByRole('button',{name:'Use this assistant'}).click();
  await expect(page.locator('#provider-button')).toHaveText('Claude Code selected');
  expect(actions).toEqual([{provider:'codex',action:'select'},{provider:'codex',action:'check'},{provider:'claude',action:'select'}]);
  await page.screenshot({path:'test-results/local-assistant-setup.png'});
});

test('head commands swap a character brain, persist it, and stay out of model inference',async({page})=>{
  test.setTimeout(100_000);
  let brains:Record<string,string>={builder:'codex',inspector:'claude'};const swaps:unknown[]=[];let inference=0;
  const state=()=>({configured:true,selectedProvider:'muse',provider:'Muse Code',brains,history:[],checks:[],proposal:null,providers:[{id:'muse',name:'Muse Code'},{id:'codex',name:'ChatGPT · Codex'},{id:'claude',name:'Claude Code'}].map(item=>({...item,installed:true,state:'connected',description:'Local assistant',message:'Verified',loginCommand:item.id,installUrl:'https://dev.meta.ai/docs/muse-code'}))});
  await page.route('**/api/court/status*',route=>route.fulfill({json:state()}));
  await page.route('**/api/court/brain',route=>{const input=route.request().postDataJSON();swaps.push(input);brains={...brains,[input.role]:input.provider};return route.fulfill({json:state()});});
  await page.route('**/api/court/converse',route=>{inference++;return route.fulfill({status:500,json:{error:'Local commands must not use inference.'}});});
  await page.goto(`/?project=${randomUUID()}`);
  await expect(page.locator('#provider-button')).toHaveText('Muse Code connected');
  await page.locator('#quiet').click();
  const command=async(text:string)=>{await page.locator('#instruction').fill(text);await page.locator('#send-instruction').click();};
  await command('Elara, open your head');await expect(page.locator('#open-head')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#brain-picker')).toBeVisible();
  await page.locator('[data-brain="claude"]').click();await expect(page.locator('[data-brain="claude"]')).toHaveAttribute('aria-pressed','true');
  expect(swaps).toEqual([{project:new URL(page.url()).searchParams.get('project'),role:'architect',provider:'claude'}]);
  await page.screenshot({path:'test-results/brain-swap.png'});
  await command('Close your head');await expect(page.locator('#brain-picker')).not.toBeVisible();
  await page.reload();await expect(page.locator('#provider-button')).toHaveText('Claude Code connected');
  await page.locator('#quiet').click();await command('Bram, open your head');
  await expect(page.locator('[data-brain="codex"]')).toHaveAttribute('aria-pressed','true');
  expect(inference).toBe(0);
});

test.describe('headset HTTPS endpoint', () => {
test.use({ baseURL: 'https://localhost:5443', ignoreHTTPSErrors: true });
test('real WebXR session supports character selection, hand typing, preview and exit', async ({ page }) => {
  test.setTimeout(145_000);
  const vrProject = randomUUID();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const runtime = await readFile('node_modules/iwer/build/iwer.min.js', 'utf8');
  await page.addInitScript({ content: `${runtime}\nwindow.xrDevice = new IWER.XRDevice(IWER.metaQuest3); window.xrDevice.installRuntime({forceInstall:true}); window.xrDevice.primaryInputMode = 'hand'; window.xrDevice.position.set(0, 1.6, 0);` });
  await page.goto(`/?project=${vrProject}`);
  await expect(page.locator('#device-note')).toContainText('Headset ready');
  await page.getByRole('button', { name: 'Enter VR', exact:false }).click();
  await expect(page.locator('body')).toHaveClass(/in-vr/);
  await expect.poll(async () => await page.evaluate(() => !!(window as any).xrDevice.activeSession)).toBe(true);

  // Aim the native hand target ray at a screen coordinate, then pinch through
  // the runtime. This exercises Three's actual WebXR select event path.
  const pinchAt = async (worldX: number, worldY: number, worldZ: number) => {
    await page.evaluate(({ x, y, z }) => {
      const hand = (window as any).xrDevice.hands.right;
      hand.position.set(0.25, 1.3, -0.4);
      const dx = x - 0.25, dy = y - 1.3, dz = z - 1.5;
      // A quaternion mapping the hand's negative Z target ray to the target.
      const length = Math.hypot(dx, dy, dz); const vx = dx / length, vy = dy / length, vz = dz / length;
      const w = 1 - vz, qLength = Math.hypot(vy, -vx, 0, w);
      hand.quaternion.set(vy / qLength, -vx / qLength, 0, w / qLength);
    }, { x: worldX, y: worldY, z: worldZ });
    await page.waitForTimeout(200);
    await page.evaluate(() => (window as any).xrDevice.hands.right.updatePinchValue(1));
    await page.waitForTimeout(160);
    await page.evaluate(() => (window as any).xrDevice.hands.right.updatePinchValue(0));
    await page.waitForTimeout(160);
  };
  await pinchAt(-1.12,1.4,-1.42);
  await expect(page.locator('[data-role="builder"]')).toHaveAttribute('aria-pressed','true');
  const panelPinch=async(x:number,y:number,composer=false)=>{
    const localX=(x/1400-.5)*2.65,localY=(.5-y/600)*1.136;
    await pinchAt(localX,(composer ? 1.23 : .66)+localY*Math.cos(-.13),(composer ? .1 : -.05)+localY*Math.sin(-.13));
  };
  await panelPinch(685,382);
  await panelPinch(806,340,true);
  await panelPinch(974,274,true);
  await expect(page.locator('#instruction')).toHaveValue('hi');
  await panelPinch(250,556,true);
  // Recenter the character court, then continue using its native hand targets.
  await panelPinch(850,489);
  await pinchAt(0,1.66,-1.29);
  await expect(page.locator('#open-head')).toHaveAttribute('aria-expanded','true');
  await pinchAt(.39,2.21,-1.33);
  await expect(page.locator('[data-brain="claude"]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'test-results/brain-court-vr.png'});
  await pinchAt(0,1.66,-1.29);
  await expect(page.locator('#open-head')).toHaveAttribute('aria-expanded','false');
  await pinchAt(1.12,1.4,-1.42);
  await expect(page.locator('[data-role="inspector"]')).toHaveAttribute('aria-pressed','true');
  await panelPinch(1132,382);
  await expect(page.locator('body')).toHaveClass(/is-preview/);await ready(page);
  await pinchAt(1.04,.85,-.4);
  await expect(page.locator('body')).not.toHaveClass(/is-preview/);
  await page.screenshot({ path: 'test-results/immersive-court.png' });
  await panelPinch(1190,489);
  await expect(page.locator('body')).not.toHaveClass(/in-vr/);
  expect(errors).toEqual([]);
});
});
