import { defineConfig } from '@playwright/test';
const isolatedPort=process.env.GOC_TEST_PORT;
const baseURL=isolatedPort?`http://127.0.0.1:${isolatedPort}`:'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/studio*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 70_000,
  expect: { timeout: 12_000 },
  use: { baseURL,
    viewport: { width: 1280, height: 800 }, deviceScaleFactor:1, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: process.platform==='win32'?['--use-angle=d3d11','--enable-unsafe-swiftshader']:['--disable-gpu','--enable-unsafe-swiftshader'] },
  },
  webServer: { command: `"${process.execPath}" scripts/dev.mjs${process.env.GOC_TEST_PRODUCTION === '1' ? ' --production' : ''}`, url: baseURL+'/api/session-capabilities', reuseExistingServer: !isolatedPort&&!process.env.CI && process.env.GOC_TEST_PRODUCTION !== '1',env:{...process.env,VITE_GOC_AVATAR_LAB:'1',...(isolatedPort?{GOC_HTTP_PORT:isolatedPort,GOC_HTTPS_PORT:String(Number(isolatedPort)+100),GOC_API_PORT:String(Number(isolatedPort)+200)}:{})}, timeout: 30_000 },
});
