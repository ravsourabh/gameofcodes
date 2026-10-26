import { defineConfig } from '@playwright/test';
import current from './playwright.config';

// Retained regression coverage for the outgoing product. It needs its own explicit service.
export default defineConfig({ ...current,
  testMatch: ['**/workspace.spec.ts', '**/guided-flow.spec.ts'],
  webServer: { command: `"${process.execPath}" scripts/dev.mjs --legacy`, url: 'http://localhost:5173/api/health', reuseExistingServer: false, timeout: 30_000 },
});
