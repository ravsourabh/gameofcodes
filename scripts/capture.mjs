import { chromium } from '@playwright/test';
console.log('Starting visual check');
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--enable-unsafe-swiftshader'] });
  console.log('Browser started');
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 } });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE:', message.text()); });
  await page.goto('http://localhost:5173/');
  console.log('Page loaded');
  await page.getByText('A court at your command.', { exact: true }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/first-look.png' });
  console.log(await page.locator('#caption').textContent());
  console.log('Secure context:', await page.evaluate(() => window.isSecureContext));
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await browser?.close(); }
