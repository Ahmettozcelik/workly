import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { AXE_TAGS, expect, mockEndpoint, problem, rateLimited, signIn, test, type MockReply } from "./support";

// Asking for a password reset link (/{locale}/forgot-password). The endpoint is
// answered here (page.route); CSRF and the session check go to the mock backend.

const ACCEPTED: MockReply = { status: 202 };
const emailField = (page: Page, name = "E-posta") => page.getByRole("textbox", { name });
const submitButton = (page: Page, name = "Bağlantı gönder") => page.getByRole("button", { name });
const sentHeading = (page: Page, name = "Gelen kutunu kontrol et") =>
  page.getByRole("heading", { level: 1, name });
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

test.describe("forgot-password page", () => {
  test("has title, heading, a labelled field and the way back", async ({ page }) => {
    await page.goto("/tr/forgot-password");
    await expect(page).toHaveTitle("Şifreni sıfırla · Workly");
    await expect(page.getByRole("heading", { level: 1, name: "Şifreni mi unuttun?" })).toBeVisible();
    await expect(emailField(page)).toHaveAttribute("type", "email");
    await expect(emailField(page)).toHaveAttribute("autocomplete", "email");
    await expect(emailField(page)).toHaveAttribute("required", "");
    await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/tr/login");
  });

  test("sends the trimmed email with the CSRF header, then asks to check the inbox", async ({ page, context }) => {
    const calls = await mockEndpoint(page, "password-reset", [ACCEPTED]);
    // Registered later, so it runs first (Playwright tries routes newest first):
    // holds the reply until released, to observe the loading state.
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/auth/password-reset", async (route) => {
      await gate;
      await route.fallback();
    });
    await page.goto("/tr/forgot-password");
    await emailField(page).fill("  ayse@example.com ");
    await submitButton(page).click();

    const busy = page.getByRole("button", { name: "Gönderiliyor" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    release();

    // The same page for any email (the API answers alike); focus moves to the new heading.
    await expect(sentHeading(page)).toBeFocused();
    await expect(page.getByText("ayse@example.com adresiyle bir Workly hesabı varsa")).toBeVisible();
    await expect(page.getByText("30 dakika geçerlidir")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş sayfasına git" })).toHaveAttribute("href", "/tr/login");
    expect(calls).toEqual([{ body: { email: "ayse@example.com" }, csrfToken: expect.any(String) }]);
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("WORKLY_SESSION");
  });

  test("a different email can be used", async ({ page }) => {
    const calls = await mockEndpoint(page, "password-reset", [ACCEPTED]);
    await page.goto("/tr/forgot-password");
    await emailField(page).fill("ayse@example.com");
    await submitButton(page).click();
    await page.getByRole("button", { name: "Farklı bir e-posta kullan" }).click();

    await expect(emailField(page)).toHaveValue("ayse@example.com");
    await emailField(page).fill("ayse.yilmaz@example.com");
    await submitButton(page).click();
    await expect(page.getByText("ayse.yilmaz@example.com adresiyle bir Workly hesabı varsa")).toBeVisible();
    expect(calls).toHaveLength(2);
  });

  test("checks the email before anything is sent", async ({ page }) => {
    const calls = await mockEndpoint(page, "password-reset", [ACCEPTED]);
    await page.goto("/tr/forgot-password");
    await submitButton(page).click();
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveAccessibleDescription(/E-posta adresini gir\./);
    await expect(emailField(page)).toBeFocused();

    await emailField(page).fill("ayse@");
    await expect(emailField(page)).toHaveAccessibleDescription(/Geçerli bir e-posta adresi gir\./);
    await emailField(page).fill("ayse@example.com");
    await expect(emailField(page)).not.toHaveAttribute("aria-invalid", "true");
    expect(calls).toEqual([]);
  });

  test("works in English", async ({ page }) => {
    await mockEndpoint(page, "password-reset", [ACCEPTED]);
    await page.goto("/en/forgot-password");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Reset your password · Workly");
    await emailField(page, "Email").fill("ali@example.com");
    await submitButton(page, "Send link").click();
    await expect(sentHeading(page, "Check your inbox")).toBeFocused();
    await expect(page.getByText("If a Workly account uses ali@example.com")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/en/login");
  });

  test("signed-in members go to the feed", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/tr/forgot-password");
    await expect(page).toHaveURL("/tr/feed");
  });

  test.describe("errors", () => {
    test.use({ expectApiErrors: true });

    test("too many requests say how long to wait and keep the input", async ({ page }) => {
      await mockEndpoint(page, "password-reset", [rateLimited(3600)]);
      await page.goto("/tr/forgot-password");
      await emailField(page).fill("ayse@example.com");
      await submitButton(page).click();
      await expect(alertWith(page, "Çok fazla deneme yapıldı")).toContainText("60 dakika sonra tekrar dene.");
      await expect(emailField(page)).toHaveValue("ayse@example.com");
      await expect(submitButton(page)).toBeEnabled();
    });

    test("a server field error is shown on the field", async ({ page }) => {
      await mockEndpoint(page, "password-reset", [
        problem(400, "VALIDATION_FAILED", [{ field: "email", code: "INVALID_EMAIL" }]),
      ]);
      await page.goto("/tr/forgot-password");
      await emailField(page).fill("ayse@example.com");
      await submitButton(page).click();
      await expect(emailField(page)).toHaveAccessibleDescription(/Geçerli bir e-posta adresi gir\./);
      await expect(emailField(page)).toBeFocused();
    });

    for (const [label, reply] of [
      ["a server error", problem(500, "INTERNAL_ERROR")],
      ["a network failure", "abort"],
    ] as const) {
      test(`${label} shows a generic error and can be retried`, async ({ page }) => {
        const calls = await mockEndpoint(page, "password-reset", [reply, ACCEPTED]);
        await page.goto("/tr/forgot-password");
        await emailField(page).fill("ayse@example.com");
        await submitButton(page).click();
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        await submitButton(page).click();
        await expect(sentHeading(page)).toBeVisible();
        expect(calls).toHaveLength(2);
      });
    }

    for (const scheme of ["light", "dark"] as const) {
      test(`has no axe violations in the ${scheme} theme (initial, error, sent)`, async ({ page }) => {
        await mockEndpoint(page, "password-reset", [problem(500, "INTERNAL_ERROR"), ACCEPTED]);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto("/tr/forgot-password");
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
        const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

        expect(await scan()).toEqual([]);
        await emailField(page).fill("ayse@example.com");
        await submitButton(page).click();
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        expect(await scan()).toEqual([]);
        await submitButton(page).click();
        await expect(sentHeading(page)).toBeVisible();
        expect(await scan()).toEqual([]);
      });
    }
  });
});
