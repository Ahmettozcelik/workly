import AxeBuilder from "@axe-core/playwright";
import type { Page, Route } from "@playwright/test";
import { AXE_TAGS, expect, problem, rateLimited, signIn, test, type MockReply } from "./support";

// The verification page (/{locale}/verify-email?token=…) and the feed banner
// for unverified members. The two endpoints are answered here (page.route);
// CSRF and the session check go to the mock backend (e2e/mock-backend.mjs).

const TOKEN = "dGVzdC10b2tlbi10aGF0LWxvb2tzLWxpa2UtdGhlLXJlYWw";
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const statusWith = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

type Call = { body: unknown; csrfToken: string | undefined };

// Answers POST /api/auth/{name} with the given replies in order (the last one repeats).
async function mockEndpoint(page: Page, name: "verify-email" | "verification-email", replies: MockReply[]) {
  const calls: Call[] = [];
  await page.route(`**/api/auth/${name}`, async (route: Route) => {
    calls.push({ body: route.request().postDataJSON(), csrfToken: route.request().headers()["x-xsrf-token"] });
    const reply = replies.length > 1 ? replies.shift()! : replies[0];
    if (reply === "abort") return route.abort("failed");
    return route.fulfill({
      status: reply.status,
      contentType: "application/problem+json",
      headers: reply.headers,
      body: reply.status === 204 ? "" : JSON.stringify(reply.body ?? {}),
    });
  });
  return calls;
}

const NO_CONTENT: MockReply = { status: 204 };

test.describe("verify-email page", () => {
  test("is not indexed and verifies nothing until the button is pressed", async ({ page }) => {
    const calls = await mockEndpoint(page, "verify-email", [NO_CONTENT]);
    await page.goto(`/tr/verify-email?token=${TOKEN}`);
    await expect(page).toHaveTitle("E-postanı doğrula · Workly");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { level: 1, name: "E-postanı doğrula" })).toBeVisible();
    await expect(page.getByRole("button", { name: "E-postamı doğrula" })).toBeEnabled();
    expect(calls).toHaveLength(0);
  });

  test("confirming verifies with the token and the CSRF header, then offers sign-in", async ({ page }) => {
    const calls = await mockEndpoint(page, "verify-email", [NO_CONTENT]);
    await page.goto(`/tr/verify-email?token=${TOKEN}`);
    await page.getByRole("button", { name: "E-postamı doğrula" }).click();

    await expect(statusWith(page, "E-postan doğrulandı")).toBeVisible();
    await expect(page.getByRole("button", { name: "E-postamı doğrula" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/tr/login");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ token: TOKEN });
    expect(calls[0].csrfToken).toBeTruthy();
  });

  test("a signed-in member continues to the feed", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await mockEndpoint(page, "verify-email", [NO_CONTENT]);
    await page.goto(`/tr/verify-email?token=${TOKEN}`);
    await page.getByRole("button", { name: "E-postamı doğrula" }).click();
    await expect(page.getByRole("link", { name: "Akışa git" })).toHaveAttribute("href", "/tr/feed");
  });

  test("works in English", async ({ page }) => {
    await mockEndpoint(page, "verify-email", [NO_CONTENT]);
    await page.goto(`/en/verify-email?token=${TOKEN}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("button", { name: "Verify my email" }).click();
    await expect(statusWith(page, "Your email is verified")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
  });

  test("without a token there is nothing to confirm", async ({ page }) => {
    const calls = await mockEndpoint(page, "verify-email", [NO_CONTENT]);
    await page.goto("/tr/verify-email");
    await expect(alertWith(page, "Bu bağlantı geçersiz ya da süresi dolmuş")).toBeVisible();
    await expect(page.getByRole("button", { name: "E-postamı doğrula" })).toHaveCount(0);
    expect(calls).toHaveLength(0);
  });

  test.describe("errors", () => {
    test.use({ expectApiErrors: true });

    test("an invalid or expired link says so and points to a new one", async ({ page }) => {
      await mockEndpoint(page, "verify-email", [problem(400, "VERIFICATION_TOKEN_INVALID")]);
      await page.goto(`/tr/verify-email?token=${TOKEN}`);
      await page.getByRole("button", { name: "E-postamı doğrula" }).click();
      const invalid = alertWith(page, "Bu bağlantı geçersiz ya da süresi dolmuş");
      await expect(invalid).toBeVisible();
      await expect(invalid).toContainText("Giriş yaptıktan sonra");
      await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    });

    test("a server error can be retried", async ({ page }) => {
      const calls = await mockEndpoint(page, "verify-email", [problem(500, "INTERNAL_ERROR"), NO_CONTENT]);
      await page.goto(`/tr/verify-email?token=${TOKEN}`);
      await page.getByRole("button", { name: "E-postamı doğrula" }).click();
      await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
      await page.getByRole("button", { name: "E-postamı doğrula" }).click();
      await expect(statusWith(page, "E-postan doğrulandı")).toBeVisible();
      expect(calls).toHaveLength(2);
    });

    for (const scheme of ["light", "dark"] as const) {
      test(`has no axe violations in the ${scheme} theme (ready, invalid)`, async ({ page }) => {
        await mockEndpoint(page, "verify-email", [problem(400, "VERIFICATION_TOKEN_INVALID")]);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`/tr/verify-email?token=${TOKEN}`);
        const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;
        expect(await scan()).toEqual([]);
        await page.getByRole("button", { name: "E-postamı doğrula" }).click();
        await expect(alertWith(page, "Bu bağlantı geçersiz ya da süresi dolmuş")).toBeVisible();
        expect(await scan()).toEqual([]);
      });
    }
  });
});

test.describe("feed banner for unverified members", () => {
  const banner = (page: Page) => page.getByRole("region", { name: "E-postanı doğrula" });

  test("shows where the link went; verified members do not see it", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/tr/feed");
    await expect(banner(page)).toContainText("deniz.arslan@example.com");
    await expect(banner(page).getByRole("button", { name: "Bağlantıyı tekrar gönder" })).toBeVisible();

    await context.clearCookies();
    await signIn(context, baseURL!, "verified");
    await page.goto("/tr/feed");
    await expect(page.getByRole("heading", { level: 2, name: "Deniz Arslan" })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test("sends a new link", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const calls = await mockEndpoint(page, "verification-email", [NO_CONTENT]);
    await page.goto("/tr/feed");
    await banner(page).getByRole("button", { name: "Bağlantıyı tekrar gönder" }).click();
    await expect(statusWith(page, "Yeni bağlantı gönderildi")).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0].csrfToken).toBeTruthy();
  });

  test.describe("errors", () => {
    test.use({ expectApiErrors: true });

    test("too many requests say how long to wait", async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await mockEndpoint(page, "verification-email", [rateLimited(45)]);
      await page.goto("/tr/feed");
      await banner(page).getByRole("button", { name: "Bağlantıyı tekrar gönder" }).click();
      await expect(alertWith(page, "Çok fazla deneme yapıldı")).toContainText("1 dakika sonra tekrar dene.");
    });

    test("a failure shows the generic error and can be retried", async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await mockEndpoint(page, "verification-email", ["abort", NO_CONTENT]);
      await page.goto("/tr/feed");
      const resend = banner(page).getByRole("button", { name: "Bağlantıyı tekrar gönder" });
      await resend.click();
      await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
      await resend.click();
      await expect(statusWith(page, "Yeni bağlantı gönderildi")).toBeVisible();
    });
  });
});
