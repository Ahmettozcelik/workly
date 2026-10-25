import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  AXE_TAGS,
  expect,
  isDesktop,
  isPhotoRequest,
  MOCK_CSRF_TOKEN,
  mockAuthApi,
  mockUser,
  photoBehind,
  problem,
  test,
  THEME_KEY,
  visiblePhoto,
} from "./support";

const nameField = (page: Page) => page.getByRole("textbox", { name: "Ad Soyad" });
const emailField = (page: Page) => page.getByRole("textbox", { name: "E-posta" });
// Password inputs have no ARIA role, so locate by name; the "structure" test
// asserts its accessible name ("Şifre", the aria-hidden "*" excluded).
const passwordField = (page: Page) => page.locator('input[name="password"]');
const submitButton = (page: Page) => page.getByRole("button", { name: "Hesap oluştur" });
const passwordToggle = (page: Page) => page.getByRole("button", { name: "Şifreyi göster" });
const themeToggle = (page: Page) => page.getByRole("button", { name: /^Tema:/ });
// The toggle's polite live region (Next.js's route announcer is assertive).
const themeAnnouncement = (page: Page) => page.locator('[aria-live="polite"]');
// The form-level error Alert (Next.js also renders an empty role="alert" route announcer).
const errorSummary = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "Bazı alanlar eksik veya hatalı" });

test.describe("structure", () => {
  test("has title, heading and labelled fields", async ({ page }) => {
    await page.goto("/tr/register");
    await expect(page).toHaveTitle("Kayıt ol · Workly");
    await expect(page.getByRole("heading", { level: 1, name: "Workly'ye katıl" })).toBeVisible();
    await expect(nameField(page)).toHaveAttribute("autocomplete", "name");
    await expect(nameField(page)).toHaveAttribute("required", "");
    await expect(emailField(page)).toHaveAttribute("type", "email");
    await expect(emailField(page)).toHaveAttribute("autocomplete", "email");
    await expect(emailField(page)).toHaveAccessibleDescription(/Kişisel e-posta adresini kullan/);
    await expect(passwordField(page)).toHaveAccessibleName("Şifre");
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(passwordField(page)).toHaveAttribute("autocomplete", "new-password");
    await expect(passwordField(page)).toHaveAccessibleDescription("En az 8 karakter.");
    await expect(submitButton(page)).toBeVisible();
    // Sign-in prompt: only "Giriş yap" is a link, to the same-language login page.
    await expect(page.getByText("Zaten hesabın var mı? Giriş yap")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/tr/login");
  });

  test("the sign-in link opens the login page", async ({ page }) => {
    await page.goto("/tr/register");
    await page.getByRole("link", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL("/tr/login");
    await expect(page.getByRole("heading", { level: 1, name: "Tekrar hoş geldin" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    // Console errors fail the test through the shared consoleGuard fixture.
  });
});

test.describe("validation", () => {
  test("empty submit shows errors and focuses the first field", async ({ page }) => {
    await page.goto("/tr/register");
    await submitButton(page).click();

    await expect(errorSummary(page)).toBeVisible();
    await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(nameField(page)).toHaveAccessibleDescription(/Adını ve soyadını gir\./);
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveAccessibleDescription(/E-posta adresini gir\./);
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAccessibleDescription(/Bir şifre belirle\./);
    await expect(nameField(page)).toBeFocused();
  });

  test("invalid email and short password show specific messages", async ({ page }) => {
    await page.goto("/tr/register");
    await nameField(page).fill("Ali Yılmaz");
    await emailField(page).fill("ali@");
    await passwordField(page).fill("kisa");
    await submitButton(page).click();

    await expect(emailField(page)).toHaveAccessibleDescription(/Geçerli bir e-posta adresi gir\./);
    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
    await expect(emailField(page)).toBeFocused();
  });

  test("errors clear live after the inputs are corrected", async ({ page }) => {
    await page.goto("/tr/register");
    await submitButton(page).click();
    await expect(errorSummary(page)).toBeVisible();

    await nameField(page).fill("Ali Yılmaz");
    await expect(nameField(page)).not.toHaveAttribute("aria-invalid", "true");
    await emailField(page).fill("ali.yilmaz@example.com");
    await expect(emailField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(errorSummary(page)).toBeVisible();

    await passwordField(page).fill("guvenli-sifre");
    await expect(passwordField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(errorSummary(page)).toHaveCount(0);
  });

  test("the backend's limits are checked before anything is sent", async ({ page }) => {
    const calls = await mockAuthApi(page, { register: [{ status: 201, body: mockUser() }] });
    await page.goto("/tr/register");
    await nameField(page).fill("x".repeat(101));
    await emailField(page).fill("ali.yilmaz@example.com");
    // 37 characters but 74 bytes: over bcrypt's 72-byte limit.
    await passwordField(page).fill("ş".repeat(37));
    await submitButton(page).click();

    await expect(nameField(page)).toHaveAccessibleDescription(/Ad Soyad en fazla 100 karakter olabilir\./);
    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifre çok uzun\. Daha kısa bir şifre seç\./);
    await expect(nameField(page)).toBeFocused();
    expect(calls).toEqual([]);
  });
});

test.describe("password toggle", () => {
  test("shows and hides the password", async ({ page }) => {
    await page.goto("/tr/register");
    await passwordField(page).fill("guvenli-sifre");

    await expect(passwordToggle(page)).toHaveAttribute("aria-pressed", "false");
    await passwordToggle(page).click();
    await expect(passwordField(page)).toHaveAttribute("type", "text");
    await expect(passwordToggle(page)).toHaveAttribute("aria-pressed", "true");

    await passwordToggle(page).click();
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(passwordToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});

// Fills a valid form (surrounding spaces must be trimmed before sending).
async function fillValidForm(page: Page) {
  await nameField(page).fill("  Ayşe Yılmaz ");
  await emailField(page).fill("ayse@example.com");
  await passwordField(page).fill("guvenli-sifre");
}

const genericError = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "İşlemini şu anda tamamlayamadık" });

test.describe("submission", () => {
  test("creates the account through the API, shows loading, then opens the feed", async ({ page }) => {
    let release = () => {};
    const calls = await mockAuthApi(
      page,
      { register: [{ status: 201, body: mockUser() }] },
      new Promise<void>((resolve) => (release = resolve)),
    );
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    const busy = page.getByRole("button", { name: "Hesap oluşturuluyor" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    release();

    await expect(page).toHaveURL("/tr/feed");
    // A CSRF token is fetched first, then sent with the trimmed values and the page's language.
    expect(calls.map((call) => call.path)).toEqual(["/api/auth/csrf", "/api/auth/register"]);
    expect(calls[1]).toEqual({
      path: "/api/auth/register",
      csrfToken: MOCK_CSRF_TOKEN,
      body: { displayName: "Ayşe Yılmaz", email: "ayse@example.com", password: "guvenli-sifre", locale: "tr" },
    });
  });

  test("an existing CSRF cookie is reused", async ({ page, context, baseURL }) => {
    const calls = await mockAuthApi(page, { register: [{ status: 201, body: mockUser() }] });
    await context.addCookies([{ name: "XSRF-TOKEN", value: "already-here", url: baseURL! }]);
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    await expect(page).toHaveURL("/tr/feed");
    expect(calls.map((call) => [call.path, call.csrfToken])).toEqual([["/api/auth/register", "already-here"]]);
  });
});

test.describe("submission errors", () => {
  test.use({ expectApiErrors: true });

  test("a taken email is shown on the email field", async ({ page }) => {
    await mockAuthApi(page, { register: [problem(409, "EMAIL_TAKEN")] });
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveAccessibleDescription(/Bu e-posta adresiyle zaten bir hesap var\./);
    await expect(emailField(page)).toBeFocused();
    await expect(errorSummary(page)).toBeVisible();
    // Everything stays as typed; editing the email clears the error.
    await expect(nameField(page)).toHaveValue("  Ayşe Yılmaz ");
    await expect(passwordField(page)).toHaveValue("guvenli-sifre");
    expect(new URL(page.url()).pathname).toBe("/tr/register");
    await emailField(page).fill("ayse.yilmaz@example.com");
    await expect(emailField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("server validation errors are shown on their fields", async ({ page }) => {
    await mockAuthApi(page, {
      register: [problem(400, "VALIDATION_FAILED", [{ field: "password", code: "TOO_SHORT" }])],
    });
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
    await expect(passwordField(page)).toBeFocused();
    await expect(genericError(page)).toHaveCount(0);
  });

  for (const [label, reply] of [
    ["a server error", problem(500, "INTERNAL_ERROR")],
    ["a network failure", "abort"],
    ["an unknown validation code", problem(400, "VALIDATION_FAILED", [{ field: "locale", code: "INVALID_LOCALE" }])],
  ] as const) {
    test(`${label} shows a generic error and keeps the input`, async ({ page }) => {
      await mockAuthApi(page, { register: [reply] });
      await page.goto("/tr/register");
      await fillValidForm(page);
      await submitButton(page).click();

      await expect(genericError(page)).toBeVisible();
      await expect(errorSummary(page)).toHaveCount(0);
      await expect(emailField(page)).toHaveValue("ayse@example.com");
      await expect(passwordField(page)).toHaveValue("guvenli-sifre");
      await expect(submitButton(page)).toBeEnabled();
      expect(new URL(page.url()).pathname).toBe("/tr/register");
    });
  }

  test("a rejected CSRF token is refreshed and the request retried once", async ({ page }) => {
    const calls = await mockAuthApi(page, {
      register: [problem(403, "CSRF_INVALID"), { status: 201, body: mockUser() }],
    });
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    await expect(page).toHaveURL("/tr/feed");
    expect(calls.map((call) => call.path)).toEqual([
      "/api/auth/csrf",
      "/api/auth/register",
      "/api/auth/csrf",
      "/api/auth/register",
    ]);
  });

  test("other 403s are not retried", async ({ page }) => {
    const calls = await mockAuthApi(page, { register: [problem(403, "FORBIDDEN")] });
    await page.goto("/tr/register");
    await fillValidForm(page);
    await submitButton(page).click();

    await expect(genericError(page)).toBeVisible();
    expect(calls.filter((call) => call.path === "/api/auth/register")).toHaveLength(1);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`no axe violations with server errors in the ${scheme} theme`, async ({ page }) => {
      await mockAuthApi(page, { register: [problem(409, "EMAIL_TAKEN"), problem(500, "INTERNAL_ERROR")] });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tr/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

      await fillValidForm(page);
      await submitButton(page).click();
      await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
      expect(await scan()).toEqual([]);

      await emailField(page).fill("ayse.yilmaz@example.com");
      await submitButton(page).click();
      await expect(genericError(page)).toBeVisible();
      expect(await scan()).toEqual([]);
    });
  }
});

test.describe("keyboard", () => {
  test("Tab order follows the visual order", async ({ page }) => {
    await page.goto("/tr/register");
    const expected = [
      page.getByRole("link", { name: "English" }),
      themeToggle(page),
      nameField(page),
      emailField(page),
      passwordField(page),
      passwordToggle(page),
      submitButton(page),
      page.getByRole("link", { name: "Kullanım Koşulları" }),
      page.getByRole("link", { name: "Aydınlatma Metni" }),
      page.getByRole("link", { name: "Giriş yap" }),
    ];
    for (const target of expected) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
    }
  });
});

test.describe("theme", () => {
  test("follows the OS on first visit and shows the matching photo", async ({ page }, testInfo) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tr/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      if (isDesktop(testInfo.project.use.viewport!.width)) {
        expect(await visiblePhoto(page)).toBe(scheme);
      }
    }
  });

  test("a stored preference wins over the OS setting", async ({ page }, testInfo) => {
    await page.addInitScript((key) => localStorage.setItem(key, "dark"), THEME_KEY);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/tr/register");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Koyu. Sistem temasına geç");
    if (isDesktop(testInfo.project.use.viewport!.width)) {
      expect(await visiblePhoto(page)).toBe("dark");
    }
  });

  test("toggle cycles System → Light → Dark → System and persists", async ({ page }, testInfo) => {
    const desktop = isDesktop(testInfo.project.use.viewport!.width);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/tr/register");
    const stored = () => page.evaluate((key) => localStorage.getItem(key), THEME_KEY);

    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Sistem. Açık temaya geç");
    await expect(themeToggle(page)).toHaveAttribute("title", "Tema: Sistem. Açık temaya geç");
    await expect(themeAnnouncement(page)).toHaveText("");

    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Açık. Koyu temaya geç");
    await expect(themeAnnouncement(page)).toHaveText("Açık tema seçildi");
    expect(await stored()).toBe("light");

    await themeToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Koyu. Sistem temasına geç");
    await expect(themeAnnouncement(page)).toHaveText("Koyu tema seçildi");
    expect(await stored()).toBe("dark");
    if (desktop) expect(await visiblePhoto(page)).toBe("dark");

    await themeToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Sistem. Açık temaya geç");
    await expect(themeAnnouncement(page)).toHaveText("Sistem teması seçildi");
    expect(await stored()).toBeNull();
    if (desktop) expect(await visiblePhoto(page)).toBe("light");
  });

  test("toggle works with the keyboard (Enter and Space)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/tr/register");

    // The language switcher comes first in the header.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(themeToggle(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Açık. Koyu temaya geç");
    await expect(themeAnnouncement(page)).toHaveText("Açık tema seçildi");

    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Tema: Koyu. Sistem temasına geç");
    await expect(themeToggle(page)).toBeFocused();
  });
});

test.describe("responsive", () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/tr/register");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator("aside")).toBeVisible({ visible: isDesktop(width) });
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`desktop fetches only the ${scheme} photo`, async ({ page }, testInfo) => {
      test.skip(!isDesktop(testInfo.project.use.viewport!.width), "photo panel is desktop-only");
      const photoRequests: string[] = [];
      page.on("request", (request) => {
        if (isPhotoRequest(request.url())) photoRequests.push(request.url());
      });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tr/register");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("aside")).toBeVisible();
      expect(photoRequests).toHaveLength(1);
      expect(await photoBehind(page, photoRequests[0])).toBe(scheme);
    });
  }

  for (const width of [375, 768]) {
    test(`no photo requests at ${width}px`, async ({ page }) => {
      const photoRequests: string[] = [];
      page.on("request", (request) => {
        if (isPhotoRequest(request.url())) photoRequests.push(request.url());
      });
      await page.setViewportSize({ width, height: 800 });
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto("/tr/register");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("aside")).toBeHidden();
      }
      expect(photoRequests).toEqual([]);
    });
  }
});

test.describe("accessibility (axe, WCAG 2.x A/AA)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`no violations in the ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tr/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
