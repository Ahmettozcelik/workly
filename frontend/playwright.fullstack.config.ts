import { defineConfig, devices } from "@playwright/test";

// Full-stack E2E (e2e-fullstack/): the frontend against the real Spring Boot
// API and PostgreSQL, no mock backend. The backend is not started here; it
// must already be running on BACKEND_URL (CI: .github/workflows/fullstack-e2e.yml).
// The fast UI suite with the mock backend stays in playwright.config.ts.

const PORT = 3100;
// Locally another port may be used, e.g. to keep a dev backend on 8080 apart.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e-fullstack",
  // The flows write to the shared database; one worker keeps them easy to follow.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "tr-TR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // The UI itself (both languages, mobile) is covered by the mock-backend suite.
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // E2E_PREBUILT=1 (CI) starts the build made in an earlier step; that build
    // must use the same BACKEND_URL (the /api rewrite is built in).
    command: process.env.E2E_PREBUILT === "1"
      ? `npx next start -p ${PORT}`
      : `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/tr/register`,
    env: { SITE_URL: `http://localhost:${PORT}`, BACKEND_URL },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
