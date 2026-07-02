import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180000, // 180秒全局测试超时
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'on-first-retry',
    viewport: { width: 375, height: 812 }, // 移动端视口
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['iPhone 12'] },
    },
  ],
  /*
  webServer: {
    command: 'npx next start -p 3002 -H 127.0.0.1',
    url: 'http://127.0.0.1:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  */
});
