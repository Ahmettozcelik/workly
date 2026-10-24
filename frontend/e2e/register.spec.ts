import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

// Every test fails if the page logs a console error or throws.
const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await use();
      expect(problems, "console errors / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

const THEME_KEY = "workly-theme";
const PHOTO_URL = /Workly-(Light|Dark)/;

const emailField = (page: Page) => page.getByRole("textbox", { name: "E-posta" });
// Password inputs have no ARIA role, so locate by name; the "structure" test
// asserts its accessible name ("Şifre", the aria-hidden "*" excluded).
const passwordField = (page: Page) => page.locator('input[name="password"]');
const submitButton = (page: Page) => page.getByRole("button", { name: "Hesap oluştur" });
const passwordToggle = (page: Page) => page.getByRole("button", { name: "Şifreyi göster" });
const themeToggle = (page: Page) => page.getByRole("button", { name: /^Theme:/ });
// The form-level error Alert (Next.js also renders an empty role="alert" route announcer).
const errorSummary = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "Bazı alanlar eksik veya hatalı" });
// Theme photo layers in the brand panel: [0] light, [1] dark.
const photoLayers = (page: Page) => page.locator('aside [style*="image-set"]');

const isDesktop = (width: number) => width >= 1024;

test.describe("structure", () => {
  test("has title, heading and labelled fields", async ({ page }) => {
    await page.goto("/register");
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
    // Sign-in prompt is plain text for now (no login page yet).
    await expect(page.getByText("Zaten hesabın var mı? Giriş yap")).toBeVisible();
    await expect(page.getByRole("link", { name: /Giriş yap/ })).toHaveCount(0);
  });
});

test.describe("validation", () => {
  test("empty submit shows errors and focuses the email field", async ({ page }) => {
    await page.goto("/register");
    await submitButton(page).click();

    await expect(errorSummary(page)).toBeVisible();
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toHaveAccessibleDescription(/E-posta adresini gir\./);
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page)).toHaveAccessibleDescription(/Bir şifre belirle\./);
    await expect(emailField(page)).toBeFocused();
  });

  test("invalid email and short password show specific messages", async ({ page }) => {
    await page.goto("/register");
    await emailField(page).fill("ali@");
    await passwordField(page).fill("kisa");
    await submitButton(page).click();

    await expect(emailField(page)).toHaveAccessibleDescription(/Geçerli bir e-posta adresi gir\./);
    await expect(passwordField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
    await expect(emailField(page)).toBeFocused();
  });

  test("errors clear live after the inputs are corrected", async ({ page }) => {
    await page.goto("/register");
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
    await page.goto("/register");
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
    await page.goto("/register");
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
    await page.goto("/register");
    const expected = [
      themeToggle(page),
      emailField(page),
      passwordField(page),
      passwordToggle(page),
      submitButton(page),
      page.getByRole("link", { name: "Kullanım Koşulları" }),
      page.getByRole("link", { name: "Aydınlatma Metni" }),
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
      await page.goto("/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      if (isDesktop(testInfo.project.use.viewport!.width)) {
        await expect(photoLayers(page).nth(scheme === "light" ? 0 : 1)).toBeVisible();
        await expect(photoLayers(page).nth(scheme === "light" ? 1 : 0)).toBeHidden();
      }
    }
  });

  test("a stored preference wins over the OS setting", async ({ page }, testInfo) => {
    await page.addInitScript((key) => localStorage.setItem(key, "dark"), THEME_KEY);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/register");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Dark. Switch to System");
    if (isDesktop(testInfo.project.use.viewport!.width)) {
      await expect(photoLayers(page).nth(1)).toBeVisible();
    }
  });

  test("toggle cycles System → Light → Dark → System and persists", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/register");
    const stored = () => page.evaluate((key) => localStorage.getItem(key), THEME_KEY);

    await expect(themeToggle(page)).toHaveAccessibleName("Theme: System. Switch to Light");
    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Light. Switch to Dark");
    expect(await stored()).toBe("light");

    await themeToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Dark. Switch to System");
    expect(await stored()).toBe("dark");

    await themeToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: System. Switch to Light");
    expect(await stored()).toBeNull();
  });
});

test.describe("responsive", () => {
  for (const width of [375, 768, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/register");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator("aside")).toBeVisible({ visible: isDesktop(width) });
    });
  }

  test("photo requests match the viewport", async ({ page }, testInfo) => {
    const photoRequests: string[] = [];
    page.on("request", (request) => {
      if (PHOTO_URL.test(decodeURIComponent(request.url()))) photoRequests.push(request.url());
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    if (isDesktop(testInfo.project.use.viewport!.width)) {
      // Only the active theme's photo is fetched.
      expect(photoRequests).toHaveLength(1);
      expect(decodeURIComponent(photoRequests[0])).toContain("Workly-Light");
    } else {
      await expect(page.locator("aside")).toBeHidden();
      expect(photoRequests).toEqual([]);
    }
  });
});

test.describe("accessibility (axe, WCAG 2.x A/AA)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`no violations in the ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
