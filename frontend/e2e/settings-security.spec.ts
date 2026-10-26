import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { AXE_TAGS, expect, mockEndpoint, problem, rateLimited, signIn, test, type MockReply } from "./support";

// The security settings page (/{locale}/settings/security): change password
// and the active sessions list. The session check goes to the mock backend;
// the page's API calls are answered here (page.route).

const NO_CONTENT: MockReply = { status: 204 };
const THIS_DEVICE = {
  id: "aaaaaaaaaaaaaaaaaaaaaa",
  current: true,
  device: "Chrome · Windows",
  createdAt: "2026-10-20T08:00:00Z",
  lastActiveAt: "2026-10-26T09:00:00Z",
};
const PHONE = {
  id: "bbbbbbbbbbbbbbbbbbbbbb",
  current: false,
  device: "Safari · iOS",
  createdAt: "2026-10-22T18:30:00Z",
  lastActiveAt: "2026-10-25T21:15:00Z",
};
const UNKNOWN = { ...PHONE, id: "cccccccccccccccccccccc", device: null };
const list = (...sessions: object[]): MockReply => ({ status: 200, body: sessions });

const currentField = (page: Page) => page.locator('input[name="currentPassword"]');
const newField = (page: Page) => page.locator('input[name="newPassword"]');
const submitButton = (page: Page, name = "Şifreyi değiştir") => page.getByRole("button", { name, exact: true });
const sessionsSection = (page: Page, name = "Aktif oturumlar") => page.getByRole("region", { name });
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const statusWith = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

async function openSignedIn(page: Page, context: Parameters<typeof signIn>[0], baseURL: string, path = "/tr/settings/security") {
  await signIn(context, baseURL);
  await page.goto(path);
}

test.describe("security settings page", () => {
  test("signed-out visitors go to the login page", async ({ page }) => {
    await page.goto("/tr/settings/security");
    await expect(page).toHaveURL("/tr/login");
  });

  test("is reached from the profile card and is not indexed", async ({ page, context, baseURL }) => {
    await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
    await openSignedIn(page, context, baseURL!, "/tr/feed");
    await page.getByRole("link", { name: "Güvenlik ve oturumlar" }).click();
    await expect(page).toHaveURL("/tr/settings/security");
    await expect(page).toHaveTitle("Güvenlik · Workly");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { level: 1, name: "Güvenlik" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Şifreyi değiştir" })).toBeVisible();
    await expect(sessionsSection(page)).toBeVisible();
    await expect(currentField(page)).toHaveAccessibleName("Mevcut şifre");
    await expect(currentField(page)).toHaveAttribute("autocomplete", "current-password");
    await expect(newField(page)).toHaveAccessibleName("Yeni şifre");
    await expect(newField(page)).toHaveAttribute("autocomplete", "new-password");
    // No navigation item is the current page here.
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(0);
  });

  test.describe("change password", () => {
    test("sends both passwords, confirms, clears the form and reloads the sessions", async ({ page, context, baseURL }) => {
      const sessionCalls = await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE), list(THIS_DEVICE)]);
      const calls = await mockEndpoint(page, "password", [NO_CONTENT]);
      await openSignedIn(page, context, baseURL!);
      await expect(sessionsSection(page).getByText("Safari · iOS", { exact: true })).toBeVisible();

      await currentField(page).fill("eski-sifre-123");
      await newField(page).fill("yeni-guvenli-sifre");
      await submitButton(page).click();

      await expect(statusWith(page, "Şifren değiştirildi")).toContainText("diğer cihazlarda oturum kapatıldı");
      await expect(currentField(page)).toHaveValue("");
      await expect(newField(page)).toHaveValue("");
      expect(calls).toEqual([
        { body: { currentPassword: "eski-sifre-123", newPassword: "yeni-guvenli-sifre" }, csrfToken: expect.any(String) },
      ]);
      // The other sessions ended: the list shows only this device now.
      await expect(sessionsSection(page).getByText("Safari · iOS", { exact: true })).toHaveCount(0);
      expect(sessionCalls).toHaveLength(2);
    });

    test("checks the fields before anything is sent", async ({ page, context, baseURL }) => {
      await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
      const calls = await mockEndpoint(page, "password", [NO_CONTENT]);
      await openSignedIn(page, context, baseURL!);
      await submitButton(page).click();
      await expect(currentField(page)).toHaveAccessibleDescription(/Mevcut şifreni gir\./);
      await expect(newField(page)).toHaveAccessibleDescription(/Yeni bir şifre belirle\./);
      await expect(currentField(page)).toBeFocused();

      await currentField(page).fill("eski-sifre-123");
      await newField(page).fill("kisa");
      await expect(newField(page)).toHaveAccessibleDescription(/Şifren en az 8 karakter olmalı\./);
      await expect(currentField(page)).not.toHaveAttribute("aria-invalid", "true");
      expect(calls).toEqual([]);
    });

    test.describe("errors", () => {
      test.use({ expectApiErrors: true });

      test("a wrong current password is shown on its field and cleared", async ({ page, context, baseURL }) => {
        await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
        await mockEndpoint(page, "password", [
          problem(400, "VALIDATION_FAILED", [{ field: "currentPassword", code: "INCORRECT" }]),
        ]);
        await openSignedIn(page, context, baseURL!);
        await currentField(page).fill("yanlis-sifre");
        await newField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(currentField(page)).toHaveAccessibleDescription(/Mevcut şifren hatalı\./);
        await expect(currentField(page)).toHaveValue("");
        await expect(currentField(page)).toBeFocused();
        await expect(newField(page)).toHaveValue("yeni-guvenli-sifre");
      });

      test("the same password again is shown on the new field", async ({ page, context, baseURL }) => {
        await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
        await mockEndpoint(page, "password", [
          problem(400, "VALIDATION_FAILED", [{ field: "newPassword", code: "SAME_AS_CURRENT" }]),
        ]);
        await openSignedIn(page, context, baseURL!);
        await currentField(page).fill("ayni-sifre-123");
        await newField(page).fill("ayni-sifre-123");
        await submitButton(page).click();
        await expect(newField(page)).toHaveAccessibleDescription(/mevcut şifrenden farklı olmalı\./);
        await expect(newField(page)).toBeFocused();
      });

      test("too many wrong passwords say how long to wait", async ({ page, context, baseURL }) => {
        await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
        await mockEndpoint(page, "password", [rateLimited(900)]);
        await openSignedIn(page, context, baseURL!);
        await currentField(page).fill("yanlis-sifre");
        await newField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(alertWith(page, "Çok fazla deneme yapıldı")).toContainText("15 dakika sonra tekrar dene.");
      });

      test("a server error keeps the input", async ({ page, context, baseURL }) => {
        await mockEndpoint(page, "sessions", [list(THIS_DEVICE)]);
        await mockEndpoint(page, "password", [problem(500, "INTERNAL_ERROR")]);
        await openSignedIn(page, context, baseURL!);
        await currentField(page).fill("eski-sifre-123");
        await newField(page).fill("yeni-guvenli-sifre");
        await submitButton(page).click();
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        await expect(newField(page)).toHaveValue("yeni-guvenli-sifre");
      });
    });
  });

  test.describe("active sessions", () => {
    test("lists this device first, then the others, with their times", async ({ page, context, baseURL }) => {
      await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE, UNKNOWN)]);
      await openSignedIn(page, context, baseURL!);
      const items = sessionsSection(page).getByRole("listitem");
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText("Chrome · Windows");
      await expect(items.nth(0)).toContainText("Bu cihaz");
      await expect(items.nth(0).getByRole("button")).toHaveCount(0);
      await expect(items.nth(1)).toContainText("Safari · iOS");
      await expect(items.nth(1)).toContainText("Oturum açıldı:");
      await expect(items.nth(1)).toContainText("Son etkinlik:");
      await expect(items.nth(2)).toContainText("Bilinmeyen cihaz");
      await expect(page.getByRole("button", { name: "Oturumu kapat (Safari · iOS)" })).toBeVisible();
    });

    test("signs out one session", async ({ page, context, baseURL }) => {
      const listCalls = await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE), list(THIS_DEVICE)]);
      const deletes: string[] = [];
      await page.route("**/api/auth/sessions/*", (route) => {
        deletes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        return route.fulfill({ status: 204 });
      });
      await openSignedIn(page, context, baseURL!);
      await page.getByRole("button", { name: "Oturumu kapat (Safari · iOS)" }).click();

      await expect(statusWith(page, "Oturum kapatıldı.")).toBeVisible();
      await expect(sessionsSection(page).getByText("Safari · iOS", { exact: true })).toHaveCount(0);
      await expect(sessionsSection(page).getByText("Şu anda yalnızca bu cihazda oturumun açık.")).toBeVisible();
      expect(deletes).toEqual([`DELETE /api/auth/sessions/${PHONE.id}`]);
      expect(listCalls).toHaveLength(2);
    });

    test("signs out all other sessions", async ({ page, context, baseURL }) => {
      await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE, UNKNOWN), list(THIS_DEVICE)]);
      const calls = await mockEndpoint(page, "sessions/revoke-others", [NO_CONTENT]);
      await openSignedIn(page, context, baseURL!);
      await page.getByRole("button", { name: "Diğer tüm oturumları kapat" }).click();

      await expect(statusWith(page, "Diğer tüm oturumlar kapatıldı.")).toBeVisible();
      await expect(sessionsSection(page).getByRole("listitem")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Diğer tüm oturumları kapat" })).toHaveCount(0);
      expect(calls).toHaveLength(1);
    });

    test("works in English", async ({ page, context, baseURL }) => {
      await mockEndpoint(page, "sessions", [list(THIS_DEVICE, UNKNOWN)]);
      await signIn(context, baseURL!, "valid-en");
      await page.goto("/en/settings/security");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle("Security · Workly");
      await expect(currentField(page)).toHaveAccessibleName("Current password");
      const items = sessionsSection(page, "Active sessions").getByRole("listitem");
      await expect(items.nth(0)).toContainText("This device");
      await expect(items.nth(1)).toContainText("Unknown device");
      await expect(page.getByRole("button", { name: "Sign out (Unknown device)" })).toBeVisible();
      await expect(submitButton(page, "Change password")).toBeVisible();
    });

    test.describe("errors", () => {
      test.use({ expectApiErrors: true });

      test("a list that cannot be loaded can be tried again", async ({ page, context, baseURL }) => {
        const calls = await mockEndpoint(page, "sessions", [problem(500, "INTERNAL_ERROR"), list(THIS_DEVICE)]);
        await openSignedIn(page, context, baseURL!);
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        await page.getByRole("button", { name: "Tekrar dene" }).click();
        await expect(sessionsSection(page).getByRole("listitem").first()).toContainText("Chrome · Windows");
        expect(calls).toHaveLength(2);
      });

      test("a failed sign-out keeps the list and says so", async ({ page, context, baseURL }) => {
        await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE)]);
        await mockEndpoint(page, "sessions/revoke-others", [problem(500, "INTERNAL_ERROR")]);
        await openSignedIn(page, context, baseURL!);
        await page.getByRole("button", { name: "Diğer tüm oturumları kapat" }).click();
        await expect(alertWith(page, "İşlemini şu anda tamamlayamadık")).toBeVisible();
        await expect(sessionsSection(page).getByText("Safari · iOS", { exact: true })).toBeVisible();
      });

      for (const scheme of ["light", "dark"] as const) {
        test(`has no axe violations in the ${scheme} theme (list, errors, success)`, async ({ page, context, baseURL }) => {
          await mockEndpoint(page, "sessions", [list(THIS_DEVICE, PHONE, UNKNOWN)]);
          await mockEndpoint(page, "password", [
            problem(400, "VALIDATION_FAILED", [{ field: "currentPassword", code: "INCORRECT" }]),
            NO_CONTENT,
          ]);
          await page.emulateMedia({ colorScheme: scheme });
          await openSignedIn(page, context, baseURL!);
          await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
          await expect(sessionsSection(page).getByRole("listitem")).toHaveCount(3);
          const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;
          expect(await scan()).toEqual([]);

          await currentField(page).fill("yanlis-sifre");
          await newField(page).fill("yeni-guvenli-sifre");
          await submitButton(page).click();
          await expect(currentField(page)).toHaveAttribute("aria-invalid", "true");
          expect(await scan()).toEqual([]);

          await currentField(page).fill("eski-sifre-123");
          await submitButton(page).click();
          await expect(statusWith(page, "Şifren değiştirildi")).toBeVisible();
          expect(await scan()).toEqual([]);
        });
      }
    });
  });
});
