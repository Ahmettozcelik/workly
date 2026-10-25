import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Test-only stand-in for the Spring Boot API (e2e/mock-backend.mjs). Its own
// port, so a backend running locally on 8080 does not clash.
const MOCK_BACKEND_PORT = 3101;
const BACKEND_URL = `http://localhost:${MOCK_BACKEND_PORT}`;

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
  webServer: [
    {
      command: "node e2e/mock-backend.mjs",
      url: `${BACKEND_URL}/health`,
      env: { MOCK_BACKEND_PORT: String(MOCK_BACKEND_PORT) },
      reuseExistingServer: false,
    },
    {
      // Always test a fresh production build (port 3100 avoids the dev server on 3000).
      // E2E_PREBUILT=1 (CI) starts the build made in an earlier step instead;
      // that build must use the same BACKEND_URL (the /api rewrite is built in).
      command: process.env.E2E_PREBUILT === "1"
        ? `npx next start -p ${PORT}`
        : `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/tr/register`,
      // Production builds require SITE_URL; the tests expect absolute canonical
      // and hreflang URLs on the test server's own origin. BACKEND_URL: the
      // session check and the /api rewrite go to the mock backend.
      env: { SITE_URL: `http://localhost:${PORT}`, BACKEND_URL },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
