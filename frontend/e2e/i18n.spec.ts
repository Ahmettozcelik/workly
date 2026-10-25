import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createTranslator } from "next-intl";
import { AXE_TAGS, expect, test } from "./support";

type Messages = { [key: string]: string | Messages };
const LOCALES = ["tr", "en"] as const;
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(__dirname, `../messages/${locale}.json`), "utf8")) as Messages,
  ]),
) as Record<(typeof LOCALES)[number], Messages>;

// Flattens messages to { "auth.register.title": "…" }.
function flatten(tree: Messages, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = `${prefix}${key}`;
    return typeof value === "string"
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, `${path}.`) };
  }, {});
}
const flat = { tr: flatten(messages.tr), en: flatten(messages.en) };
const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (message: string) => [...message.matchAll(/<(\/?)(\w+)>/g)].map((m) => `${m[1]}${m[2]}`);

test.describe("message files", () => {
  test("tr.json and en.json have identical keys", () => {
    expect(Object.keys(flat.en).sort()).toEqual(Object.keys(flat.tr).sort());
  });

  test("every message keeps the same placeholders", () => {
    for (const [key, message] of Object.entries(flat.tr)) {
      expect(placeholders(flat.en[key] ?? ""), key).toEqual(placeholders(message));
    }
  });

  test("every message keeps the same, balanced rich-text tags", () => {
    for (const [key, message] of Object.entries(flat.tr)) {
      const trTags = tags(message);
      expect(tags(flat.en[key] ?? ""), key).toEqual(trTags);
      const opened = trTags.filter((tag) => !tag.startsWith("/"));
      expect(trTags.filter((tag) => tag.startsWith("/")), key).toEqual(opened.map((tag) => `/${tag}`));
    }
  });

  test("every message formats without errors in both languages", () => {
    for (const locale of LOCALES) {
      const errors: string[] = [];
      const t = createTranslator({
        locale,
        messages: messages[locale],
        onError: (error) => errors.push(`${locale}: ${error.message}`),
      });
      for (const [key, message] of Object.entries(flat[locale])) {
        const values: Record<string, string | ((chunks: string) => string)> = {};
        for (const name of placeholders(message)) values[name] = "x";
        for (const tag of tags(message)) {
          if (!tag.startsWith("/")) values[tag] = (chunks) => `[${chunks}]`;
        }
        // @ts-expect-error -- keys come from the JSON at runtime
        t.markup(key, values);
      }
      expect(errors).toEqual([]);
    }
    const legal = createTranslator({ locale: "en", messages: messages.en }).markup(
      // @ts-expect-error -- key from the JSON at runtime
      "auth.register.legal",
      { terms: (c: string) => `[${c}]`, privacy: (c: string) => `[${c}]` },
    );
    expect(legal).toBe(
      "By continuing, you agree to the [Terms of Use] and acknowledge that you have read our [Privacy Notice].",
    );
  });
});

// English page helpers.
const emailField = (page: Page) => page.getByRole("textbox", { name: "Email" });
const passwordField = (page: Page) => page.locator('input[name="password"]');
const submitButton = (page: Page) => page.getByRole("button", { name: "Create account" });
const themeToggle = (page: Page) => page.getByRole("button", { name: /^Theme:/ });
const themeAnnouncement = (page: Page) => page.locator('[aria-live="polite"]');
const errorSummary = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "Some fields are missing or need attention." });

test.describe("English register page", () => {
  test.use({ locale: "en-US" });

  test("renders English content", async ({ page }) => {
    await page.goto("/en/register");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Sign up · Workly");
    await expect(page.getByRole("heading", { level: 1, name: "Join Workly" })).toBeVisible();
    await expect(page.getByText("Get started with one personal account.")).toBeVisible();
    await expect(emailField(page)).toHaveAccessibleDescription(
      "Use your personal email address. You can add your work email later to link your account to your company.",
    );
    await expect(passwordField(page)).toHaveAccessibleName("Password");
    await expect(passwordField(page)).toHaveAccessibleDescription("Use at least 8 characters.");
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(submitButton(page)).toBeVisible();
    await expect(page.getByText("Required field")).toBeVisible();
    await expect(page.getByText("Already have an account? Sign in")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
    await expect(page.locator("form p").last()).toHaveText(
      "By continuing, you agree to the Terms of Use and acknowledge that you have read our Privacy Notice.",
    );
    await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "#kullanim-kosullari");
    await expect(page.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "#aydinlatma-metni");
    await expect(page.getByText("Prototype", { exact: true }).first()).toBeAttached();
    // No Turkish copy leaks into the English page.
    for (const turkish of ["Kayıt", "Şifre", "E-posta", "Tema", "Hesap oluştur", "Prototip"]) {
      await expect(page.locator("body"), turkish).not.toContainText(turkish);
    }
  });

  test("shows English validation messages", async ({ page }) => {
    await page.goto("/en/register");
    await submitButton(page).click();
    await expect(errorSummary(page)).toContainText("Please fix the marked fields and try again.");
    await expect(emailField(page)).toHaveAccessibleDescription(/Enter your email address\./);
    await expect(passwordField(page)).toHaveAccessibleDescription(/Create a password\./);
    await expect(emailField(page)).toBeFocused();

    await emailField(page).fill("ali@");
    await passwordField(page).fill("short");
    await submitButton(page).click();
    await expect(emailField(page)).toHaveAccessibleDescription(/Enter a valid email address\./);
    await expect(passwordField(page)).toHaveAccessibleDescription(
      /Your password must be at least 8 characters\./,
    );

    await emailField(page).fill("ali.yilmaz@example.com");
    await passwordField(page).fill("secure-password");
    await expect(errorSummary(page)).toHaveCount(0);
  });

  test("shows the English success preview", async ({ page }) => {
    await page.goto("/en/register");
    await emailField(page).fill("ali.yilmaz@example.com");
    await passwordField(page).fill("secure-password");
    await submitButton(page).click();

    const busy = page.getByRole("button", { name: "Creating account" });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeFocused();
    await expect(page.getByRole("status")).toContainText(
      "We've sent a verification link to ali.yilmaz@example.com.",
    );
    await expect(
      page.getByText(
        "Once you verify your email, you can post, apply for jobs, and send messages. You can complete your profile anytime.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Prototype: No real account was created and no email was sent."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Join Workly" })).toBeVisible();
    await expect(emailField(page)).toBeFocused();
  });

  test("labels the theme toggle in English", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/register");
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: System. Switch to light theme");
    await expect(themeToggle(page)).toHaveAttribute("title", "Theme: System. Switch to light theme");

    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Light. Switch to dark theme");
    await expect(themeAnnouncement(page)).toHaveText("Light theme selected");
    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Dark. Switch to system theme");
    await expect(themeAnnouncement(page)).toHaveText("Dark theme selected");
    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: System. Switch to light theme");
    await expect(themeAnnouncement(page)).toHaveText("System theme selected");
  });

  test("has no horizontal overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/en/register");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`has no axe violations in the ${scheme} theme (initial, error, success)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/register");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

      expect(await scan()).toEqual([]);
      await submitButton(page).click();
      await expect(errorSummary(page)).toBeVisible();
      expect(await scan()).toEqual([]);
      await emailField(page).fill("ali.yilmaz@example.com");
      await passwordField(page).fill("secure-password");
      await submitButton(page).click();
      await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
      expect(await scan()).toEqual([]);
    });
  }
});

test.describe("locale detection", () => {
  test("a request without a language preference goes to Turkish", async ({ request }) => {
    for (const [from, to] of [["/register", "/tr/register"], ["/login", "/tr/login"], ["/", "/tr"]]) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(307);
      expect(response.headers()["location"], from).toBe(to);
      expect(response.headers()["set-cookie"], from).toBeUndefined();
    }
  });

  for (const [browserLocale, from, expected] of [
    ["en-US", "/register", "/en/register"],
    ["tr-TR", "/register", "/tr/register"],
    ["de-DE", "/register", "/tr/register"],
    ["en-US", "/login", "/en/login"],
    ["tr-TR", "/login", "/tr/login"],
  ] as const) {
    test(`a ${browserLocale} browser opening ${from} lands on ${expected}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ locale: browserLocale, baseURL });
      const page = await context.newPage();
      await page.goto(from);
      await expect(page).toHaveURL(expected);
      await expect(page.locator("html")).toHaveAttribute("lang", expected.slice(1, 3));
      await context.close();
    });
  }
});

test.describe("metadata", () => {
  const pages = [
    { path: "/tr", lang: "tr", title: "Workly", description: "Profesyonel yolculuğun burada başlıyor.", unprefixed: "/" },
    { path: "/en", lang: "en", title: "Workly", description: "Your professional journey starts here.", unprefixed: "/" },
    { path: "/tr/register", lang: "tr", title: "Kayıt ol · Workly", description: "Tek bir kişisel hesapla başla.", unprefixed: "/register" },
    { path: "/en/register", lang: "en", title: "Sign up · Workly", description: "Get started with one personal account.", unprefixed: "/register" },
    { path: "/tr/login", lang: "tr", title: "Giriş yap · Workly", description: "Kişisel hesabınla giriş yap.", unprefixed: "/login" },
    { path: "/en/login", lang: "en", title: "Sign in · Workly", description: "Sign in with your personal account.", unprefixed: "/login" },
  ];

  for (const { path, lang, title, description, unprefixed } of pages) {
    test(`${path} has localized title, description, canonical and hreflang`, async ({ page, baseURL }) => {
      const url = (pathname: string) => new URL(pathname, baseURL).toString();
      const suffix = unprefixed === "/" ? "" : unprefixed;
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page).toHaveTitle(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", url(path));

      // Compared as parsed URLs: Next.js prints the bare origin without its
      // trailing slash ("http://host" for "http://host/"), the same URL.
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          links.map((l) => [l.getAttribute("hreflang"), new URL(l.getAttribute("href") ?? "").href]),
        );
      expect(Object.fromEntries(alternates)).toEqual({
        tr: url(`/tr${suffix}`),
        en: url(`/en${suffix}`),
        "x-default": url(unprefixed),
      });
    });
  }

  test("pages and redirects send no automatic Link (hreflang) header", async ({ request }) => {
    for (const path of ["/tr", "/en", "/tr/register", "/en/register", "/tr/login", "/en/login", "/register", "/login", "/"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["link"], path).toBeUndefined();
    }
  });

  test("404 pages carry no canonical or hreflang", async ({ request }) => {
    const response = await request.get("/tr/does-not-exist");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('rel="alternate"');
  });
});

test.describe("design system in production", () => {
  test("stays unavailable in both languages", async ({ request }) => {
    const redirect = await request.get("/design-system", { maxRedirects: 0 });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers()["location"]).toBe("/tr/design-system");
    for (const path of ["/tr/design-system", "/en/design-system"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
