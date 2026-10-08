import { defineConfig, devices } from '@playwright/test';

// Phone specs (e2e/mobile-*.spec.ts) run only in the "mobile" project: a phone's screen, touch and no hover.
const MOBILE_SPECS = /mobile-.*\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: MOBILE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        // Fake camera and microphone for the recording studio.
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      testMatch: MOBILE_SPECS,
      use: {
        ...devices['Pixel 7'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
