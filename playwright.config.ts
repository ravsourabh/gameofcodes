import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 70_000,
  expect: { timeout: 12_000 },
  use: { baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 }, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-gpu', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173/api/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
});
