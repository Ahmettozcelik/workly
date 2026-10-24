import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Turkish browser by default, so unprefixed URLs resolve to /tr. Tests for
    // other languages set the locale explicitly.
    locale: "tr-TR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  // Always test a fresh production build (port 3100 avoids the dev server on 3000).
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/tr/register`,
    // Production builds require SITE_URL; the tests expect absolute canonical
    // and hreflang URLs on the test server's own origin.
    env: { SITE_URL: `http://localhost:${PORT}` },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
