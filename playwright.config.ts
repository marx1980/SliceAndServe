import { defineConfig } from '@playwright/test';

// Set PW_CHROME to use an already-installed Chrome instead of Playwright's downloaded browser.
const executablePath = process.env.PW_CHROME || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173/',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    { name: 'phone-320', use: { viewport: { width: 320, height: 640 } } },
    { name: 'phone-375', use: { viewport: { width: 375, height: 667 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
  ],
});
