import { defineConfig, devices } from '@playwright/test';

// E2E on the web export (npm run build:web) with the installed Microsoft Edge and a fake speech engine.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // tests are independent (fresh browser context each), so they run side by side: 2 here (more ran out of memory
  // on the dev PC), 3 on GitHub Actions (.github/workflows/e2e.yml)
  fullyParallel: true,
  workers: process.env.CI ? 3 : 2,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { baseURL: 'http://localhost:8099', channel: 'msedge', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve.mjs dist 8099', url: 'http://localhost:8099', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
