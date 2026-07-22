import { defineConfig, devices } from '@playwright/test';

// E2E suite for the three critical KYC flows.
// Runs against the Vite dev server (test hooks are DEV-only) with mocked
// canister actors injected via window.__TEST_*__ and HTTP services mocked
// via page.route. No dfx replica or OCR server required.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Fake camera for the face-verification step
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
    permissions: ['camera'],
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-handoff\.spec\.js/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile-handoff\.spec\.js/,
    },
  ],
  webServer: {
    command: 'npx vite --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
