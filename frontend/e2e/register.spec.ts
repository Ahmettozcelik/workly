import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  AXE_TAGS,
  expect,
  isDesktop,
  isPhotoRequest,
  photoBehind,
  test,
  THEME_KEY,
  visiblePhoto,
} from "./support";

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
  test("empty submit shows errors and focuses the email field", async ({ page }) => {
    await page.goto("/tr/register");
    await submitButton(page).click();

    await expect(errorSummary(page)).toBeVisible();
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveAccessibleDescription(/E-posta adresini gir\./);
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAccessibleDescription(/Bir şifre belirle\./);
    await expect(emailField(page)).toBeFocused();
  });

  test("invalid email and short password show specific messages", async ({ page }) => {
    await page.goto("/tr/register");
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

    await emailField(page).fill("ali.yilmaz@example.com");
    await expect(emailField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(errorSummary(page)).toBeVisible();

    await passwordField(page).fill("guvenli-sifre");
    await expect(passwordField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(errorSummary(page)).toHaveCount(0);
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

test.describe("submission (prototype)", () => {
  test("shows loading, then success, and returns with the email kept", async ({ page }) => {
    await page.goto("/tr/register");
    await emailField(page).fill("ali.yilmaz@example.com");
    await passwordField(page).fill("guvenli-sifre");
    await submitButton(page).click();

    const busy = page.getByRole("button", { name: "Hesap oluşturuluyor" });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute("aria-busy", "true");

    const successHeading = page.getByRole("heading", { level: 1, name: "E-postanı kontrol et" });
    await expect(successHeading).toBeFocused();
    await expect(page.getByRole("status")).toContainText(
      "Doğrulama bağlantısını ali.yilmaz@example.com adresine gönderdik.",
    );
    await expect(
      page.getByText("Prototip: Gerçek bir hesap oluşturulmadı ve e-posta gönderilmedi."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Farklı bir e-posta kullan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Workly'ye katıl" })).toBeVisible();
    await expect(emailField(page)).toHaveValue("ali.yilmaz@example.com");
    await expect(passwordField(page)).toHaveValue("");
    await expect(emailField(page)).toBeFocused();
  });
});

test.describe("keyboard", () => {
  test("Tab order follows the visual order", async ({ page }) => {
    await page.goto("/tr/register");
    const expected = [
      themeToggle(page),
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
  for (const width of [375, 768, 1280]) {
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
