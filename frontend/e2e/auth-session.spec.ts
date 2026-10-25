import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { AXE_TAGS, expect, SESSION_COOKIE, SIGNED_IN, signIn, test } from "./support";

// Session handling end to end through the Next.js server: the session check
// (src/lib/auth/server.ts) asks the mock backend (e2e/mock-backend.mjs), which
// decides by the WORKLY_SESSION cookie (see signIn in support.ts).

const profile = (page: Page) => page.getByRole("region", { name: SIGNED_IN.name });
const logoutButton = (page: Page) => page.getByRole("button", { name: "Çıkış yap" });

test.describe("protected feed", () => {
  for (const [lang, feed, login] of [
    ["tr", "/tr/feed", "/tr/login"],
    ["en", "/en/feed", "/en/login"],
  ] as const) {
    test(`without a session, ${feed} sends to ${login}`, async ({ page }) => {
      await page.goto(feed);
      await expect(page).toHaveURL(login);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByText(SIGNED_IN.name)).toHaveCount(0);
    });
  }

  test("an expired session sends to login too", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "expired");
    await page.goto("/tr/feed");
    await expect(page).toHaveURL("/tr/login");
    await expect(page.getByRole("textbox", { name: "E-posta" })).toBeVisible();
  });

  test("with a session, the feed shows the signed-in member", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/tr/feed");
    await expect(page).toHaveURL("/tr/feed");
    await expect(profile(page).getByRole("heading", { level: 2, name: SIGNED_IN.name })).toBeVisible();
    await expect(profile(page).getByText(SIGNED_IN.email)).toBeVisible();
    // Header avatar uses the same name (in the DOM; hidden on small screens).
    await expect(page.getByRole("banner").locator(`[role="img"][aria-label="${SIGNED_IN.name}"]`)).toBeAttached();
    // Unverified member: no badge. No sample member or sample profile numbers.
    await expect(page.getByText("E-posta doğrulandı")).toHaveCount(0);
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(0);
    await expect(page.getByText("Profil görüntülenme")).toHaveCount(0);
  });

  test("a verified member sees the verified badge", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "verified");
    await page.goto("/tr/feed");
    await expect(profile(page).getByText("E-posta doğrulandı")).toBeVisible();
  });

  test("the browser never sees the session cookie or stores anything", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/tr/feed");
    const fromScript = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(fromScript.cookie).not.toContain(SESSION_COOKIE);
    expect(fromScript.local).toEqual([]);
    expect(fromScript.session).toEqual([]);
  });
});

test.describe("signed-in members skip login and register", () => {
  for (const [from, to] of [
    ["/tr/login", "/tr/feed"],
    ["/tr/register", "/tr/feed"],
    ["/en/login", "/en/feed"],
    ["/en/register", "/en/feed"],
  ] as const) {
    test(`${from} sends to ${to}`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await page.goto(from);
      await expect(page).toHaveURL(to);
    });
  }

  test("an expired session still gets the login form", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "expired");
    await page.goto("/tr/login");
    await expect(page).toHaveURL("/tr/login");
    await expect(page.getByRole("heading", { level: 1, name: "Tekrar hoş geldin" })).toBeVisible();
  });

  test("if the backend cannot answer, login is still shown", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "backend-error");
    await page.goto("/tr/login");
    await expect(page).toHaveURL("/tr/login");
    await expect(page.getByRole("heading", { level: 1, name: "Tekrar hoş geldin" })).toBeVisible();
  });
});

test.describe("feed when the backend cannot answer", () => {
  // The failed server render is logged by the browser; the page itself must
  // still show a proper error with a retry.
  test.use({ expectServerError: true });

  test("shows an error with a retry, not a sign-in prompt", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "backend-error");
    await page.goto("/tr/feed");
    await expect(page).toHaveURL("/tr/feed");
    await expect(page.getByRole("heading", { level: 1, name: "Akış yüklenemedi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  });

  test("retry loads the feed once the backend answers again", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "backend-error");
    await page.goto("/tr/feed");
    await expect(page.getByRole("heading", { level: 1, name: "Akış yüklenemedi" })).toBeVisible();

    // The backend recovers (here: the session is valid again).
    await signIn(context, baseURL!);
    await page.getByRole("button", { name: "Tekrar dene" }).click();
    await expect(profile(page).getByRole("heading", { level: 2, name: SIGNED_IN.name })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the error page has no axe violations in the ${scheme} theme`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!, "backend-error");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/feed");
      await expect(page.getByRole("heading", { level: 1, name: "The feed couldn't load" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("logout", () => {
  test("ends the session with a CSRF-protected request and opens login", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/tr/feed");
    const logoutRequest = page.waitForRequest(
      (request) => request.url().endsWith("/api/auth/logout") && request.method() === "POST",
    );
    await logoutButton(page).click();

    const request = await logoutRequest;
    expect(request.headers()["x-xsrf-token"]).toBeTruthy();
    await expect(page).toHaveURL("/tr/login");
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain(SESSION_COOKIE);

    // The feed is closed again, also through the back button.
    await page.goto("/tr/feed");
    await expect(page).toHaveURL("/tr/login");
    await page.goBack();
    await expect(page).toHaveURL(/\/tr\/login$/);
  });

  test("keeps the language", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "valid-en");
    await page.goto("/en/feed");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/en/login");
  });

  test("shows the loading state while signing out", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/auth/logout", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/tr/feed");
    await logoutButton(page).click();

    const busy = page.getByRole("button", { name: "Çıkış yapılıyor" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    release();
    await expect(page).toHaveURL("/tr/login");
  });

  test.describe("failures", () => {
    test.use({ expectApiErrors: true });

    test("a failed logout keeps the member signed in and says so", async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!, "logout-error");
      await page.goto("/tr/feed");
      await logoutButton(page).click();

      await expect(page.getByRole("alert").filter({ hasText: "Çıkış yapılamadı. Lütfen tekrar dene." })).toBeVisible();
      await expect(page).toHaveURL("/tr/feed");
      await expect(logoutButton(page)).toBeEnabled();
    });

    test("a network failure keeps the member signed in and says so", async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await page.route("**/api/auth/logout", (route) => route.abort("failed"));
      await page.goto("/tr/feed");
      await logoutButton(page).click();

      await expect(page.getByRole("alert").filter({ hasText: "Çıkış yapılamadı. Lütfen tekrar dene." })).toBeVisible();
      await expect(page).toHaveURL("/tr/feed");
    });
  });
});
