import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  AXE_TAGS,
  expect,
  isDesktop,
  MOCK_CSRF_TOKEN,
  mockAuthApi,
  mockUser,
  problem,
  test,
} from "./support";

const INVALID_CREDENTIALS = problem(401, "INVALID_CREDENTIALS");

const COPY = {
  tr: {
    path: "/tr/login",
    title: "Giriş yap · Workly",
    heading: "Tekrar hoş geldin",
    email: "E-posta",
    password: "Şifre",
    show: "Şifreyi göster",
    submit: "Giriş yap",
    submitting: "Giriş yapılıyor",
    forgot: "Şifreni mi unuttun?",
    soon: "Yakında",
    register: "Kayıt ol",
    summary: "Bazı alanlar eksik veya hatalı",
    emailEmpty: "E-posta adresini gir.",
    emailInvalid: "Geçerli bir e-posta adresi gir.",
    passwordEmpty: "Şifreni gir.",
    failureTitle: "Giriş yapılamadı",
    failureBody: "E-posta adresi veya şifre hatalı. Lütfen tekrar dene.",
    genericTitle: "İşlemini şu anda tamamlayamadık",
    feedPath: "/tr/feed",
    theme: /^Tema:/,
    otherLanguage: "English",
  },
  en: {
    path: "/en/login",
    title: "Sign in · Workly",
    heading: "Welcome back",
    email: "Email",
    password: "Password",
    show: "Show password",
    submit: "Sign in",
    submitting: "Signing in",
    forgot: "Forgot your password?",
    soon: "Coming soon",
    register: "Sign up",
    summary: "Some fields are missing or need attention.",
    emailEmpty: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
    passwordEmpty: "Enter your password.",
    failureTitle: "Couldn't sign in",
    failureBody: "The email or password you entered is incorrect. Please try again.",
    genericTitle: "We couldn't complete that right now",
    feedPath: "/en/feed",
    theme: /^Theme:/,
    otherLanguage: "Türkçe",
  },
} as const;
type Copy = (typeof COPY)[keyof typeof COPY];

const emailField = (page: Page, c: Copy) => page.getByRole("textbox", { name: c.email });
// Password inputs have no ARIA role; the structure test asserts the accessible name.
const passwordField = (page: Page) => page.locator('input[name="password"]');
const submitButton = (page: Page, c: Copy) => page.getByRole("button", { name: c.submit, exact: true });
const passwordToggle = (page: Page, c: Copy) => page.getByRole("button", { name: c.show });
const forgotButton = (page: Page, c: Copy) => page.getByRole("button", { name: c.forgot });
// Next.js also renders an empty role="alert" route announcer, so filter by text.
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

for (const [lang, c] of Object.entries(COPY) as [keyof typeof COPY, Copy][]) {
  test.describe(`login (${lang})`, () => {
    test.use({ locale: lang === "tr" ? "tr-TR" : "en-US" });

    test("has title, heading, labelled fields and links", async ({ page }) => {
      await page.goto(c.path);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page).toHaveTitle(c.title);
      await expect(page.getByRole("heading", { level: 1, name: c.heading })).toBeVisible();

      await expect(emailField(page, c)).toHaveAttribute("type", "email");
      await expect(emailField(page, c)).toHaveAttribute("autocomplete", "username");
      await expect(passwordField(page)).toHaveAccessibleName(c.password);
      await expect(passwordField(page)).toHaveAttribute("type", "password");
      await expect(passwordField(page)).toHaveAttribute("autocomplete", "current-password");
      await expect(passwordToggle(page, c)).toHaveAttribute("aria-pressed", "false");

      await expect(page.getByRole("link", { name: c.register })).toHaveAttribute(
        "href",
        `/${lang}/register`,
      );
    });

    test("forgot password is a clearly unavailable placeholder", async ({ page }) => {
      await page.goto(c.path);
      const forgot = forgotButton(page, c);
      await expect(forgot).toHaveAttribute("aria-disabled", "true");
      await expect(forgot).toHaveAttribute("type", "button");
      await expect(forgot).toHaveAccessibleDescription(c.soon);
      await expect(page.getByText(c.soon, { exact: true })).toBeVisible();

      // Activating it does nothing: no navigation, no submit, no validation.
      // (force: Playwright treats aria-disabled as disabled and would wait.)
      const url = page.url();
      await forgot.click({ force: true });
      await forgot.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      expect(page.url()).toBe(url);
      await expect(alertWith(page, c.summary)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: c.heading })).toBeVisible();
    });

    test("empty submit shows errors and focuses the email field", async ({ page }) => {
      await page.goto(c.path);
      await submitButton(page, c).click();
      await expect(alertWith(page, c.summary)).toBeVisible();
      await expect(emailField(page, c)).toHaveAttribute("aria-invalid", "true");
      await expect(emailField(page, c)).toHaveAccessibleDescription(c.emailEmpty);
      await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
      await expect(passwordField(page)).toHaveAccessibleDescription(c.passwordEmpty);
      await expect(emailField(page, c)).toBeFocused();
    });

    test("invalid email is reported and errors clear live", async ({ page }) => {
      await page.goto(c.path);
      await emailField(page, c).fill("ali@");
      await submitButton(page, c).click();
      await expect(emailField(page, c)).toHaveAccessibleDescription(c.emailInvalid);
      await expect(emailField(page, c)).toBeFocused();

      await emailField(page, c).fill("ali.yilmaz@example.com");
      await expect(emailField(page, c)).not.toHaveAttribute("aria-invalid", "true");
      await passwordField(page).fill("abc");
      await expect(passwordField(page)).not.toHaveAttribute("aria-invalid", "true");
      await expect(alertWith(page, c.summary)).toHaveCount(0);
    });

    test("has no minimum password length and submits once on Enter", async ({ page }) => {
      let release = () => {};
      const calls = await mockAuthApi(
        page,
        { login: [{ status: 200, body: mockUser(lang) }] },
        new Promise<void>((resolve) => (release = resolve)),
      );
      await page.goto(c.path);
      await emailField(page, c).fill("ali.yilmaz@example.com");
      await passwordField(page).fill("abc");
      await passwordField(page).press("Enter");

      const busy = page.getByRole("button", { name: c.submitting });
      await expect(busy).toBeDisabled();
      await expect(busy).toHaveAttribute("aria-busy", "true");
      // A second attempt while busy is ignored.
      await passwordField(page).press("Enter");
      release();
      await expect(page).toHaveURL(c.feedPath);
      expect(calls.filter((call) => call.path === "/api/auth/login")).toHaveLength(1);
    });

    test("success signs in through the API and opens the feed", async ({ page }) => {
      const calls = await mockAuthApi(page, { login: [{ status: 200, body: mockUser(lang) }] });
      await page.goto(c.path);
      await emailField(page, c).fill(" ali.yilmaz@example.com ");
      await passwordField(page).fill("secure-password");
      await submitButton(page, c).click();

      await expect(page).toHaveURL(c.feedPath);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      // A CSRF token is fetched first, then sent with the trimmed email.
      expect(calls.map((call) => call.path)).toEqual(["/api/auth/csrf", "/api/auth/login"]);
      expect(calls[1]).toEqual({
        path: "/api/auth/login",
        csrfToken: MOCK_CSRF_TOKEN,
        body: { email: "ali.yilmaz@example.com", password: "secure-password" },
      });
    });
  });

  test.describe(`login API errors (${lang})`, () => {
    test.use({ locale: lang === "tr" ? "tr-TR" : "en-US", expectApiErrors: true });

    test("failure is generic, keeps the email and resets the password", async ({ page }) => {
      await mockAuthApi(page, { login: [INVALID_CREDENTIALS] });
      await page.goto(c.path);
      await emailField(page, c).fill("ali.yilmaz@example.com");
      await passwordField(page).fill("wrong-password");
      await passwordToggle(page, c).click();
      await expect(passwordField(page)).toHaveAttribute("type", "text");
      await submitButton(page, c).click();

      const failure = alertWith(page, c.failureTitle);
      await expect(failure).toBeVisible();
      await expect(failure).toContainText(c.failureBody);
      // No field-level hint about which part was wrong.
      await expect(emailField(page, c)).not.toHaveAttribute("aria-invalid", "true");
      await expect(passwordField(page)).not.toHaveAttribute("aria-invalid", "true");
      await expect(emailField(page, c)).toHaveValue("ali.yilmaz@example.com");
      await expect(passwordField(page)).toHaveValue("");
      await expect(passwordField(page)).toHaveAttribute("type", "password");
      await expect(passwordToggle(page, c)).toHaveAttribute("aria-pressed", "false");
      await expect(passwordField(page)).toBeFocused();

      // The alert goes away while the next attempt is in flight (held here),
      // and comes back as a new alert, so it is announced again.
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/api/auth/login", async (route) => {
        await held;
        await route.fulfill({
          status: 401,
          contentType: "application/problem+json",
          body: JSON.stringify(INVALID_CREDENTIALS.body),
        });
      });
      await passwordField(page).fill("another-try");
      await submitButton(page, c).click();
      await expect(failure).toHaveCount(0);
      release();
      await expect(alertWith(page, c.failureTitle)).toBeVisible();
    });

    for (const [label, reply] of [
      ["a server error", problem(500, "INTERNAL_ERROR")],
      ["a network failure", "abort"],
    ] as const) {
      test(`${label} shows a generic error and keeps the input`, async ({ page }) => {
        await mockAuthApi(page, { login: [reply] });
        await page.goto(c.path);
        await emailField(page, c).fill("ali.yilmaz@example.com");
        await passwordField(page).fill("secure-password");
        await submitButton(page, c).click();

        await expect(alertWith(page, c.genericTitle)).toBeVisible();
        await expect(alertWith(page, c.failureTitle)).toHaveCount(0);
        await expect(emailField(page, c)).toHaveValue("ali.yilmaz@example.com");
        await expect(passwordField(page)).toHaveValue("secure-password");
        await expect(submitButton(page, c)).toBeEnabled();
        expect(new URL(page.url()).pathname).toBe(c.path);
      });
    }

    for (const scheme of ["light", "dark"] as const) {
      test(`has no axe violations in the ${scheme} theme (initial, error, failure, server error)`, async ({ page }) => {
        await mockAuthApi(page, { login: [INVALID_CREDENTIALS, problem(500, "INTERNAL_ERROR")] });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(c.path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
        const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

        expect(await scan()).toEqual([]);
        await submitButton(page, c).click();
        await expect(alertWith(page, c.summary)).toBeVisible();
        expect(await scan()).toEqual([]);

        await emailField(page, c).fill("ali.yilmaz@example.com");
        await passwordField(page).fill("wrong-password");
        await submitButton(page, c).click();
        await expect(alertWith(page, c.failureTitle)).toBeVisible();
        expect(await scan()).toEqual([]);

        await passwordField(page).fill("secure-password");
        await submitButton(page, c).click();
        await expect(alertWith(page, c.genericTitle)).toBeVisible();
        expect(await scan()).toEqual([]);
      });
    }
  });

  test.describe(`login keyboard (${lang})`, () => {
    test.use({ locale: lang === "tr" ? "tr-TR" : "en-US" });

    test("Tab order follows the visual order", async ({ page }) => {
      await page.goto(c.path);
      const expected = [
        page.getByRole("link", { name: c.otherLanguage }),
        page.getByRole("button", { name: c.theme }),
        emailField(page, c),
        passwordField(page),
        passwordToggle(page, c),
        forgotButton(page, c),
        submitButton(page, c),
        page.getByRole("link", { name: c.register }),
      ];
      for (const target of expected) {
        await page.keyboard.press("Tab");
        await expect(target).toBeFocused();
      }
    });
  });
}

test.describe("login responsive", () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/tr/login", "/en/login"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
        await expect(page.locator("aside")).toBeVisible({ visible: isDesktop(width) });
      }
    });
  }
});

test.describe("login keeps credentials out of the browser", () => {
  test.use({ expectApiErrors: true });

  test("no storage after a failure or a success; only the server's cookies", async ({ page, context }) => {
    await mockAuthApi(page, { login: [INVALID_CREDENTIALS, { status: 200, body: mockUser() }] });
    await page.goto("/tr/login");
    const c = COPY.tr;
    await emailField(page, c).fill("ali.yilmaz@example.com");
    await passwordField(page).fill("wrong-password");
    await submitButton(page, c).click();
    await expect(alertWith(page, c.failureTitle)).toBeVisible();

    await passwordField(page).fill("secure-password");
    await submitButton(page, c).click();
    await expect(page).toHaveURL(c.feedPath);

    // Only the cookies the server set: the CSRF token and the HttpOnly session
    // (not readable by scripts). The page itself stores nothing.
    const cookies = await context.cookies();
    expect(cookies.map((cookie) => cookie.name).sort()).toEqual(["WORKLY_SESSION", "XSRF-TOKEN"]);
    expect(cookies.find((cookie) => cookie.name === "WORKLY_SESSION")?.httpOnly).toBe(true);
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: [], session: [], cookie: expect.not.stringContaining("WORKLY_SESSION") });
  });
});
