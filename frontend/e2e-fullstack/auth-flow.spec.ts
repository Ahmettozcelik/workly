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
});
