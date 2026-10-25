import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../e2e/support";

// Authentication end to end: browser → Next.js (/api rewrite, server-side
// session check) → Spring Boot → PostgreSQL. Nothing is mocked. Every test
// signs up its own member with a unique email, so runs never share accounts
// and a database that already has data is never read or changed otherwise.

const newMember = () => ({
  displayName: "Uçtan Uca Test",
  email: `e2e-${randomUUID()}@example.com`,
  password: `Pw-${randomUUID()}`,
});
type Member = ReturnType<typeof newMember>;

const emailField = (page: Page) => page.getByRole("textbox", { name: "E-posta" });
const passwordField = (page: Page) => page.locator('input[name="password"]');
const profile = (page: Page, member: Member) => page.getByRole("region", { name: member.displayName });
const logoutButton = (page: Page) => page.getByRole("button", { name: "Çıkış yap" });
// Next.js also renders an empty role="alert" route announcer, so filter by text.
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

async function expectFeedOf(page: Page, member: Member) {
  await expect(page).toHaveURL("/tr/feed");
  await expect(profile(page, member).getByRole("heading", { level: 2, name: member.displayName })).toBeVisible();
  await expect(profile(page, member).getByText(member.email)).toBeVisible();
}

async function logIn(page: Page, email: string, password: string) {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
}

async function logOut(page: Page) {
  await logoutButton(page).click();
  await expect(page).toHaveURL("/tr/login");
  await expect(page.getByRole("heading", { level: 1, name: "Tekrar hoş geldin" })).toBeVisible();
}

test("register → feed → logout → login → feed → logout", async ({ page }) => {
  const member = newMember();

  await page.goto("/tr/register");
  await page.getByRole("textbox", { name: "Ad Soyad" }).fill(member.displayName);
  await emailField(page).fill(member.email);
  await passwordField(page).fill(member.password);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  // Registering signs the new member in.
  await expectFeedOf(page, member);

  await logOut(page);
  // The session is gone on the backend too, not only in the browser.
  await page.goto("/tr/feed");
  await expect(page).toHaveURL("/tr/login");

  await logIn(page, member.email, member.password);
  await expectFeedOf(page, member);

  await logOut(page);
  await page.goto("/tr/feed");
  await expect(page).toHaveURL("/tr/login");
});

test("pages get the frontend's security headers, /api keeps the backend's own", async ({ request }) => {
  const page = (await request.get("/tr/login")).headers();
  expect(page["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(page["x-frame-options"]).toBe("DENY");
  expect(page["x-powered-by"]).toBeUndefined();

  // Spring Security's headers, passed through once by the /api rewrite.
  const api = (await request.get("/api/auth/csrf")).headers();
  expect(api["x-frame-options"]).toBe("DENY");
  expect(api["x-content-type-options"]).toBe("nosniff");
  expect(api["cache-control"]).toContain("no-store");
  expect(api["content-security-policy"]).toBeUndefined();
  expect(api["permissions-policy"]).toBeUndefined();
  expect(api["x-powered-by"]).toBeUndefined();
});

test.describe("wrong password", () => {
  // The rejected sign-in is a 401 from the API; the browser logs it.
  test.use({ expectApiErrors: true });

  test("is refused, and the right one still signs in", async ({ page, request }) => {
    const member = newMember();

    // Set up the account through the API (its own cookie jar, not the page's),
    // which also checks the real CSRF protection through the /api rewrite.
    const withoutToken = await request.post("/api/auth/register", { data: { ...member, locale: "tr" } });
    expect(withoutToken.status()).toBe(403);
    expect((await withoutToken.json()).code).toBe("CSRF_INVALID");

    expect((await request.get("/api/auth/csrf")).ok()).toBe(true);
    const { cookies } = await request.storageState();
    const csrfToken = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
    expect(csrfToken).toBeTruthy();
    const registered = await request.post("/api/auth/register", {
      data: { ...member, locale: "tr" },
      headers: { "X-XSRF-TOKEN": csrfToken! },
    });
    expect(registered.status()).toBe(201);

    await page.goto("/tr/login");
    await logIn(page, member.email, `${member.password}-wrong`);
    await expect(alertWith(page, "Giriş yapılamadı")).toBeVisible();
    await expect(alertWith(page, "E-posta adresi veya şifre hatalı. Lütfen tekrar dene.")).toBeVisible();
    await expect(page).toHaveURL("/tr/login");
    // The form clears the rejected password.
    await expect(passwordField(page)).toHaveValue("");
    await page.goto("/tr/feed");
    await expect(page).toHaveURL("/tr/login");

    await logIn(page, member.email, member.password);
    await expectFeedOf(page, member);
  });

  test("five in a row block the email for a while, even with the right one", async ({ page }) => {
    // An unknown email is limited the same way as a member's (LoginThrottle).
    const email = newMember().email;
    const loginResponse = () => page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
    await page.goto("/tr/login");
    for (let attempt = 1; attempt <= 5; attempt++) {
      const failed = loginResponse();
      await logIn(page, email, `wrong-${attempt}`);
      expect((await failed).status()).toBe(401);
      await expect(alertWith(page, "Giriş yapılamadı")).toBeVisible();
    }

    const limited = loginResponse();
    await logIn(page, email, "any-password");
    const response = await limited;
    expect(response.status()).toBe(429);
    // Retry-After reaches the browser through the Next.js proxy.
    expect(Number(response.headers()["retry-after"])).toBeGreaterThan(14 * 60);
    await expect(alertWith(page, "Çok fazla deneme yapıldı")).toContainText("15 dakika sonra tekrar dene.");
    await expect(page).toHaveURL("/tr/login");
  });
});
