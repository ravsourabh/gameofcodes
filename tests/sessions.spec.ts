import {pinchAction} from './fixtures/xr';
import {leaveGuide} from './fixtures/desktop';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('new entry saves and reloads a session without invoking the retired product', async ({ page, request }) => {
  const errors: string[] = [], retired: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/court|\/preview|:417[45]/.test(request.url())) retired.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  await leaveGuide(page);
  await expect(page.getByRole('heading', { name: 'What brings you here?' })).toBeVisible();
  await page.getByRole('button', { name: 'Practise a situation' }).click();
  await page.getByRole('button', { name: 'Session details', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-environment', 'rehearsal');
  await page.getByLabel('Session name').fill('Research defence 研究');
  await page.getByLabel('What would you like to explore or practise?').fill('Defend my proposal. What evidence supports it?');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  const id = new URL(page.url()).searchParams.get('session')!;
  const profile = await page.locator('#profile-select').inputValue();
  await page.reload();
  await expect(page.getByLabel('Session name')).toHaveValue('Research defence 研究');
  await expect(page.getByLabel('What would you like to explore or practise?')).toHaveValue('Defend my proposal. What evidence supports it?');
  await expect(page.locator('body')).toHaveAttribute('data-environment', 'rehearsal');
  const response = await request.get(`/api/sessions/${id}?profileId=${profile}`);
  expect((await response.json()).session.events).toHaveLength(1);
  const directFile = await request.get(`/.sovereign/sessions/v1/${profile}/${id}.json`);
  expect([403, 404]).toContain(directFile.status());
  expect((await request.get('/api/health')).status()).toBe(200);
  expect((await request.post('/api/court/build', { data: {} })).status()).toBe(404);
  expect((await request.get('/preview')).status()).toBe(410);
  expect(retired).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/wave-1-rehearsal.png', fullPage: true });
});

test('profiles keep sessions separate and preserve legacy browser metadata', async ({ page }) => {
  const profile = randomUUID(), old = [{ id: profile, name: 'Existing profile', projects: { local: randomUUID() } }];
  await page.addInitScript(value => { if (!localStorage.getItem('goc-profiles')) localStorage.setItem('goc-profiles', JSON.stringify(value)); }, old);
  await page.goto('/?project=' + old[0].projects.local);
  await leaveGuide(page);
  await expect(page.locator('#legacy-notice')).toBeVisible();
  await page.getByRole('button', { name: 'Discuss a problem' }).click();
  await page.getByRole('button', { name: 'Session details', exact: true }).click();
  await page.getByLabel('Session name').fill('A private draft');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#saved-sessions')).toContainText('A private draft');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'New profile', exact: true }).click();
  await page.getByLabel('Profile name', { exact: true }).fill('Another profile');
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await expect(page.locator('#saved-sessions')).not.toContainText('A private draft');
  await page.getByLabel('Current profile').selectOption(profile);
  await expect(page.locator('#saved-sessions')).toContainText('A private draft');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('goc-profiles')!))).toEqual(old);
});

test('a lost save response can be retried without creating a duplicate session', async ({ page }) => {
  await page.goto('/'); await leaveGuide(page); await page.getByRole('button', { name: 'Discuss a problem' }).click();
  await page.getByRole('button', { name: 'Session details', exact: true }).click();
  await page.getByLabel('Session name').fill('One save only');
  let dropped = false;
  await page.route('**/api/sessions?*', async route => {
    if (route.request().method() === 'POST' && !dropped) { dropped = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('#error-box')).toBeVisible();
  await expect(page.getByLabel('Session name')).toHaveValue('One save only');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('[data-session]')).toHaveCount(1);
});

test('conflicting edits remain visible until the user reloads the saved version', async ({ page, request }) => {
  await page.goto('/'); await leaveGuide(page); await page.getByRole('button', { name: 'Discuss a problem' }).click();
  await page.getByRole('button', { name: 'Session details', exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click(); await expect(page.locator('#save-status')).toHaveText('Saved');
  const id = new URL(page.url()).searchParams.get('session')!, profile = await page.locator('#profile-select').inputValue();
  await request.patch(`/api/sessions/${id}?profileId=${profile}`, { headers: { Origin: 'http://localhost:5173' }, data: { requestId: randomUUID(), expectedRevision: 1, action: 'update', draft: { title: 'Saved in another tab', mode: 'discussion', situation: '' } } });
  await page.getByLabel('Session name').fill('My unsaved edit');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('#error-message')).toContainText('another tab');
  await expect(page.getByLabel('Session name')).toHaveValue('My unsaved edit');
  await page.getByRole('button', { name: 'Reload saved version' }).click();
  await expect(page.getByLabel('Session name')).toHaveValue('Saved in another tab');
});

test.describe('hands-first WebXR foundation', () => {test.describe.configure({timeout:150000});
  test.use({ baseURL: 'https://localhost:5443', ignoreHTTPSErrors: true });
  test('native hand rays select the council, save, and exit without a preview service', async ({ page }) => {
    const runtime = await readFile('node_modules/iwer/build/iwer.min.js', 'utf8');
    await page.addInitScript({ content: `${runtime}\nwindow.xrDevice = new IWER.XRDevice(IWER.metaQuest3); window.xrDevice.installRuntime({ forceInstall: true }); window.xrDevice.primaryInputMode = 'hand'; window.xrDevice.position.set(0, 1.6, 0);` });
    await page.goto('/'); await expect(page.locator('#xr-status')).toContainText('Headset ready');
    await leaveGuide(page);
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await expect(page.locator('body')).toHaveAttribute('data-xr-active', 'true');
    await pinchAction(page,'rehearsal'); await expect(page.locator('body')).toHaveAttribute('data-environment', 'rehearsal');
    await pinchAction(page,'save'); await expect(page.locator('#save-status')).toHaveText('Saved');
    expect(new URL(page.url()).searchParams.get('session')).toBeTruthy();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/sessions/*?*', async route => { if (route.request().method() === 'PATCH') await gate; await route.continue(); });
    await pinchAction(page,'save'); await expect(page.locator('#save-status')).toHaveText('Saving…');
    await pinchAction(page,'exit'); await expect(page.locator('body')).toHaveAttribute('data-xr-active', 'false');
    release(); await expect(page.locator('#save-status')).toHaveText('Saved');
  });
});
