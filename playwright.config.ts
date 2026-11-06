import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3000',
    url: `${baseURL}/transferencias`,
    reuseExistingServer: false,
    env: { CONTAS_STORAGE: 'memory' },
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
