import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/sessions.spec.ts', '**/characters.spec.ts', '**/conversation.spec.ts','**/guided-setup.spec.ts','**/realistic.spec.ts','**/discussion.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 70_000,
  expect: { timeout: 12_000 },
  use: { baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 }, deviceScaleFactor:1, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: process.platform==='win32'?['--use-angle=d3d11','--enable-unsafe-swiftshader']:['--disable-gpu','--enable-unsafe-swiftshader'] },
  },
  webServer: { command: `"${process.execPath}" scripts/dev.mjs${process.env.GOC_TEST_PRODUCTION === '1' ? ' --production' : ''}`, url: 'http://localhost:5173/api/session-capabilities', reuseExistingServer: !process.env.CI && process.env.GOC_TEST_PRODUCTION !== '1', timeout: 30_000 },
});
