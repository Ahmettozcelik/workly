import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
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

// Registers through the form; the page then asks to check the inbox, whether
// or not the email already had an account. No session is started.
async function register(page: Page, member: Member) {
  await page.goto("/tr/register");
  await page.getByRole("textbox", { name: "Ad Soyad" }).fill(member.displayName);
  await emailField(page).fill(member.email);
  await passwordField(page).fill(member.password);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gelen kutunu kontrol et" })).toBeVisible();
  await expect(page.getByText(`${member.email} adresine bir e-posta gönderdik.`)).toBeVisible();
  await expect(page).toHaveURL("/tr/register");
}

async function logOut(page: Page) {
  await logoutButton(page).click();
  await expect(page).toHaveURL("/tr/login");
  await expect(page.getByRole("heading", { level: 1, name: "Tekrar hoş geldin" })).toBeVisible();
}

test("register → check inbox → login → feed → logout → login → feed → logout", async ({ page }) => {
  const member = newMember();

  await register(page, member);
  // Registering starts no session.
  await page.goto("/tr/feed");
  await expect(page).toHaveURL("/tr/login");

  // Signing in works before the email is verified.
  await logIn(page, member.email, member.password);
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

// Mailpit's HTTP API (CI: the mailpit service in fullstack-e2e.yml). The
// backend's mailed links must point to this frontend (APP_BASE_URL).
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

// The text of the newest mail with this subject that Mailpit received for the
// address (mails are sent in the background, so it is polled for).
async function mailedText(request: APIRequestContext, email: string, subject: string) {
  const query = `to:"${email}" subject:"${subject}"`;
  const search = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`;
  let id: string | undefined;
  await expect
    .poll(async () => {
      const found = (await (await request.get(search)).json()) as { messages: { ID: string }[] };
      id = found.messages[0]?.ID;
      return id;
    }, { message: `a mail "${subject}" to ${email} in Mailpit`, timeout: 15_000 })
    .toBeTruthy();
  const message = (await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Text: string };
  return message.Text;
}

// The verification link from the last verification mail for this address.
async function mailedVerificationLink(request: APIRequestContext, email: string) {
  const text = await mailedText(request, email, "Workly e-posta adresini doğrula");
  const link = text.match(/https?:\/\/\S+\/tr\/verify-email\?token=[A-Za-z0-9_-]+/)?.[0];
  expect(link, "verification link in the mail").toBeTruthy();
  return link!;
}

test("the mailed link verifies the email", async ({ page, request }) => {
  const member = newMember();
  const banner = page.getByRole("region", { name: "E-postanı doğrula" });

  await register(page, member);
  await page.goto("/tr/login");
  await logIn(page, member.email, member.password);
  await expectFeedOf(page, member);
  await expect(banner).toContainText(member.email);
  await expect(profile(page, member).getByText("E-posta doğrulandı")).toHaveCount(0);

  const link = await mailedVerificationLink(request, member.email);
  expect(new URL(link).origin, "the link points to this frontend").toBe(new URL(page.url()).origin);
  await page.goto(link);
  await page.getByRole("button", { name: "E-postamı doğrula" }).click();
  await expect(page.getByRole("status").filter({ hasText: "E-postan doğrulandı" })).toBeVisible();

  await page.getByRole("link", { name: "Akışa git" }).click();
  await expectFeedOf(page, member);
  await expect(profile(page, member).getByText("E-posta doğrulandı")).toBeVisible();
  await expect(banner).toHaveCount(0);
});

test("registering a verified member's email again looks the same and mails the owner", async ({ browser, request }) => {
  const member = newMember();
  const owner = await browser.newPage();
  await register(owner, member);
  // Verified from the link, signed out (another device).
  await owner.goto(await mailedVerificationLink(request, member.email));
  await owner.getByRole("button", { name: "E-postamı doğrula" }).click();
  await expect(owner.getByRole("status").filter({ hasText: "E-postan doğrulandı" })).toBeVisible();
  await owner.close();

  // Someone else, with another name and password: the same answer as for a new account.
  const other = await browser.newPage();
  await register(other, { ...member, displayName: "Başka Biri", password: `Pw-${randomUUID()}` });
  await other.close();

  const notice = await mailedText(request, member.email, "Zaten bir Workly hesabın var");
  expect(notice).toContain(`Merhaba ${member.displayName}`);
  expect(notice).toMatch(/https?:\/\/\S+\/tr\/login/);

  // The account is unchanged: the original password still signs in.
  const page = await browser.newPage();
  await page.goto("/tr/login");
  await logIn(page, member.email, member.password);
  await expectFeedOf(page, member);
  await expect(profile(page, member).getByText("E-posta doğrulandı")).toBeVisible();
  await page.close();
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
    expect(registered.status()).toBe(202);

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

// Asks for a reset link from the login page; the page answers alike for any email.
async function requestPasswordReset(page: Page, email: string) {
  await page.goto("/tr/login");
  await page.getByRole("link", { name: "Şifreni mi unuttun?" }).click();
  await expect(page).toHaveURL("/tr/forgot-password");
  await emailField(page).fill(email);
  await page.getByRole("button", { name: "Bağlantı gönder" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gelen kutunu kontrol et" })).toBeVisible();
}

test.describe("password reset", () => {
  // The refused old password is a 401 from the API; the browser logs it.
  test.use({ expectApiErrors: true });

  test("the mailed link sets a new password and signs the member out everywhere", async ({
    page,
    browser,
    request,
  }) => {
    const member = newMember();
    const newPassword = `Pw-${randomUUID()}`;
    await register(page, member);

    // Signed in on another device.
    const otherDevice = await browser.newPage();
    await otherDevice.goto("/tr/login");
    await logIn(otherDevice, member.email, member.password);
    await expectFeedOf(otherDevice, member);

    await requestPasswordReset(page, member.email);
    const text = await mailedText(request, member.email, "Workly şifreni sıfırla");
    const link = text.match(/https?:\/\/\S+\/tr\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0];
    expect(link, "reset link in the mail").toBeTruthy();
    expect(new URL(link!).origin, "the link points to this frontend").toBe(new URL(page.url()).origin);

    await page.goto(link!);
    // The token is taken off the address bar.
    await expect(page).toHaveURL("/tr/reset-password");
    await passwordField(page).fill(newPassword);
    await page.getByRole("button", { name: "Şifremi değiştir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Şifren değiştirildi" })).toBeVisible();
    expect(await mailedText(request, member.email, "Workly şifren değiştirildi")).toContain(
      `Merhaba ${member.displayName}`,
    );

    // The other device's session is gone.
    await otherDevice.goto("/tr/feed");
    await expect(otherDevice).toHaveURL("/tr/login");
    await otherDevice.close();

    // The old password no longer works; the new one does, and the email counts as verified.
    await page.goto("/tr/login");
    await logIn(page, member.email, member.password);
    await expect(alertWith(page, "Giriş yapılamadı")).toBeVisible();
    await logIn(page, member.email, newPassword);
    await expectFeedOf(page, member);
    await expect(profile(page, member).getByText("E-posta doğrulandı")).toBeVisible();

    // The link worked once.
    await logOut(page);
    await page.goto(link!);
    await passwordField(page).fill(`Pw-${randomUUID()}`);
    await page.getByRole("button", { name: "Şifremi değiştir" }).click();
    await expect(alertWith(page, "Bu bağlantı geçersiz ya da süresi dolmuş")).toBeVisible();
  });

  test("an unknown email gets the same page and no mail", async ({ page, request }) => {
    const email = newMember().email;
    await requestPasswordReset(page, email);
    // The lookup runs in the background: give it time to (not) send anything.
    await page.waitForTimeout(3_000);
    const search = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;
    const found = (await (await request.get(search)).json()) as { messages: unknown[] };
    expect(found.messages).toEqual([]);
  });
});
