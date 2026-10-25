import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import WebSocket from 'ws';
import { chromium } from '@playwright/test';

const site = new URL(process.env.VERIFY_SITE || 'https://gameofcodes.si');
const project = process.argv[2];
assert.ok(project, 'Pass an existing built project UUID.');
assert.match(project, /^[a-f0-9-]{36}$/i);
const html = await fetch(site).then(r => r.text());
assert.ok(html.includes('id="boot-screen"') && html.includes('/arrival.js'));
console.log('PASS immediate startup shell');

await new Promise((resolve, reject) => {
  const url = new URL('/preview', site); url.protocol = site.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('project', project);
  const socket = new WebSocket(url, { origin: site.origin });
  const timeout = setTimeout(() => { socket.terminate(); reject(new Error('No public preview frame within 20 seconds')); }, 20000);
  socket.on('error', reject);
  socket.on('unexpected-response', (_, response) => { clearTimeout(timeout); response.resume(); reject(new Error(`Preview HTTP ${response.statusCode}`)); });
  socket.on('message', (data, binary) => {
    if (!binary) {
      const message = JSON.parse(data.toString());
      if (message.type === 'error') { clearTimeout(timeout); socket.close(); reject(new Error(message.message)); }
      return;
    }
    assert.ok(data.length > 1000); clearTimeout(timeout); socket.close(); resolve();
  });
});
console.log('PASS actual preview frames through public proxy');

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL(`/?project=${project}`, site).href);
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await page.locator('#review-work').click();
  assert.equal(await page.locator('#garden-overlay').isVisible(), false, 'Entry CTA must close in preview');
  await page.locator('#connection-status').filter({ hasText: 'Live browser · saved to your project' }).waitFor({ timeout: 25000 });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/public-preview.png' });
  assert.deepEqual(errors, []);
  console.log('PASS browser displays live preview without JavaScript errors');
} finally { await browser.close(); }
