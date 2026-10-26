import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { AXE_TAGS, expect, mockEndpoint, problem, signIn, test, type MockReply } from "./support";

// Choosing a new password from a reset link (/{locale}/reset-password?token=…).
// The endpoint is answered here (page.route); CSRF goes to the mock backend.

const TOKEN = "dGVzdC10b2tlbi10aGF0LWxvb2tzLWxpa2UtdGhlLXJlYWw";
const NO_CONTENT: MockReply = { status: 204 };
const ENDPOINT = "password-reset/confirm";
const passwordField = (page: Page) => page.locator('input[name="password"]');
const submitButton = (page: Page, name = "Şifremi değiştir") => page.getByRole("button", { name });
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const statusWith = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const INVALID = "Bu bağlantı geçersiz ya da süresi dolmuş";

test.describe("reset-password page", () => {
  test("is not indexed, labels the field and takes the token off the address bar", async ({ page }) => {
    const calls = await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto(`/tr/reset-password?token=${TOKEN}`);
    await expect(page).toHaveTitle("Yeni şifre belirle · Workly");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { level: 1, name: "Yeni şifre belirle" })).toBeVisible();
    await expect(passwordField(page)).toHaveAccessibleName("Yeni şifre");
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(passwordField(page)).toHaveAttribute("autocomplete", "new-password");
    await expect(passwordField(page)).toHaveAccessibleDescription("En az 8 karakter.");
    // The token lives in memory only: not in the URL or the history entry.
    await expect(page).toHaveURL("/tr/reset-password");
    expect(calls).toHaveLength(0);
  });

  test("changes the password with the token, then offers sign-in", async ({ page }) => {
    const calls = await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto(`/tr/reset-password?token=${TOKEN}`);
    await passwordField(page).fill("yeni-guvenli-sifre");
    await page.getByRole("button", { name: "Şifreyi göster" }).click();
    await expect(passwordField(page)).toHaveAttribute("type", "text");
    await submitButton(page).click();

    await expect(statusWith(page, "Şifren değiştirildi")).toContainText("bütün cihazlarda oturumun kapatıldı");
    await expect(passwordField(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/tr/login");
    expect(calls).toEqual([{ body: { token: TOKEN, password: "yeni-guvenli-sifre" }, csrfToken: expect.any(String) }]);
  });

  test("checks the password before anything is sent", async ({ page }) => {
    const calls = await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto(`/tr/reset-password?token=${TOKEN}`);
    await submitButton(page).click();
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAccessibleDescription(/Yeni bir şifre belirle\./);
    await expect(passwordField(page)).toBeFocused();

    await passwordField(page).fill("kisa");
    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
    // 37 characters but 74 bytes: over bcrypt's 72-byte limit.
    await passwordField(page).fill("ş".repeat(37));
    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifre çok uzun\./);
    expect(calls).toEqual([]);
  });

  test("without a token there is nothing to submit", async ({ page }) => {
    const calls = await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto("/tr/reset-password");
    await expect(alertWith(page, INVALID)).toBeVisible();
    await expect(passwordField(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Yeni bağlantı iste" })).toHaveAttribute("href", "/tr/forgot-password");
    expect(calls).toHaveLength(0);
  });

  test("works signed in too", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto(`/tr/reset-password?token=${TOKEN}`);
    await passwordField(page).fill("yeni-guvenli-sifre");
    await submitButton(page).click();
    await expect(statusWith(page, "Şifren değiştirildi")).toBeVisible();
  });

  test("works in English", async ({ page }) => {
    await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
    await page.goto(`/en/reset-password?token=${TOKEN}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(passwordField(page)).toHaveAccessibleName("New password");
    await passwordField(page).fill("new-secure-password");
    await submitButton(page, "Change my password").click();
    await expect(statusWith(page, "Your password was changed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
  });

  test("Tab order follows the visual order", async ({ page }) => {
    await page.goto(`/tr/reset-password?token=${TOKEN}`);
    const expected = [
      page.getByRole("link", { name: "English" }),
      page.getByRole("button", { name: /^Tema:/ }),
      passwordField(page),
      page.getByRole("button", { name: "Şifreyi göster" }),
      submitButton(page),
    ];
    for (const target of expected) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
    }
  });

  test.describe("errors", () => {
    test.use({ expectApiErrors: true });

    for (const [label, reply] of [
      ["an unknown, used or expired link", problem(400, "PASSWORD_RESET_TOKEN_INVALID")],
      ["a malformed token", problem(400, "VALIDATION_FAILED", [{ field: "token", code: "TOO_LONG" }])],
    ] as const) {
      test(`${label} says so and points to a new one`, async ({ page }) => {
        await mockEndpoint(page, ENDPOINT, [reply]);
        await page.goto(`/tr/reset-password?token=${TOKEN}`);
        await passwordField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(alertWith(page, INVALID)).toContainText("30 dakika");
        await expect(passwordField(page)).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Yeni bağlantı iste" })).toBeVisible();
      });
    }

    test("a server field error is shown on the field", async ({ page }) => {
      await mockEndpoint(page, ENDPOINT, [
        problem(400, "VALIDATION_FAILED", [{ field: "password", code: "TOO_SHORT" }]),
      ]);
      await page.goto(`/tr/reset-password?token=${TOKEN}`);
      await passwordField(page).fill("yeni-guvenli-sifre");
      await submitButton(page).click();
      await expect(passwordField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
      await expect(passwordField(page)).toBeFocused();
    });

    for (const [label, reply] of [
      ["a server error", problem(500, "INTERNAL_ERROR")],
      ["a network failure", "abort"],
    ] as const) {
      test(`${label} keeps the input and can be retried`, async ({ page }) => {
        const calls = await mockEndpoint(page, ENDPOINT, [reply, NO_CONTENT]);
        await page.goto(`/tr/reset-password?token=${TOKEN}`);
        await passwordField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        await expect(passwordField(page)).toHaveValue("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(statusWith(page, "Şifren değiştirildi")).toBeVisible();
        expect(calls).toHaveLength(2);
      });
    }

    for (const scheme of ["light", "dark"] as const) {
      test(`has no axe violations in the ${scheme} theme (form, invalid, done)`, async ({ page }) => {
        await mockEndpoint(page, ENDPOINT, [problem(400, "PASSWORD_RESET_TOKEN_INVALID")]);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`/tr/reset-password?token=${TOKEN}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
        const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

        expect(await scan()).toEqual([]);
        await passwordField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(alertWith(page, INVALID)).toBeVisible();
        expect(await scan()).toEqual([]);

        await page.unroute(`**/api/auth/${ENDPOINT}`);
        await mockEndpoint(page, ENDPOINT, [NO_CONTENT]);
        await page.goto(`/tr/reset-password?token=${TOKEN}`);
        await passwordField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(statusWith(page, "Şifren değiştirildi")).toBeVisible();
        expect(await scan()).toEqual([]);
      });
    }
  });
});
