import { defineConfig, devices } from '@playwright/test';

// E2E on the web export (npm run build:web) with the installed Microsoft Edge and a fake speech engine.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8099', channel: 'msedge', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve.mjs dist 8099', url: 'http://localhost:8099', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
