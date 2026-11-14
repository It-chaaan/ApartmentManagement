import { defineConfig, devices } from '@playwright/test'

if (process.env.E2E_ISOLATED !== '1' || !process.env.E2E_BASE_URL) {
  throw new Error('Run browser tests with npm run test:e2e so they use a disposable database.')
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
