import type { Page } from "@playwright/test";
import { expect, test, THEME_KEY } from "./support";

const switcher = (page: Page, name: "English" | "Türkçe") => page.getByRole("link", { name, exact: true });
const themeToggle = (page: Page) => page.getByRole("button", { name: /^(Tema|Theme):/ });

const DAY = 24 * 60 * 60;

test.describe("language switcher", () => {
  test("links the same page in the other language", async ({ page }) => {
    for (const [path, name, target] of [
      ["/tr/login", "English", "/en/login"],
      ["/en/login", "Türkçe", "/tr/login"],
      ["/tr/register", "English", "/en/register"],
      ["/en/register", "Türkçe", "/tr/register"],
    ] as const) {
      await page.goto(path);
      const link = switcher(page, name);
      await expect(link, path).toHaveAttribute("href", target);
      await expect(link, path).toHaveAttribute("hreflang", target.slice(1, 3));
      await expect(link, path).toHaveAttribute("lang", target.slice(1, 3));
    }
  });

  test("Turkish → English keeps the page", async ({ page }) => {
    await page.goto("/tr/login");
    await switcher(page, "English").click();
    await expect(page).toHaveURL("/en/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(switcher(page, "Türkçe")).toBeVisible();
  });

  test("English → Turkish keeps the page", async ({ page }) => {
    await page.goto("/en/register");
    await switcher(page, "Türkçe").click();
    await expect(page).toHaveURL("/tr/register");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("heading", { level: 1, name: "Workly'ye katıl" })).toBeVisible();
  });

  test("stores the choice in a year-long NEXT_LOCALE cookie", async ({ page, context }) => {
    await page.goto("/tr/login");
    expect(await context.cookies()).toEqual([]);
    await switcher(page, "English").click();
    await expect(page).toHaveURL("/en/login");

    const cookie = (await context.cookies()).find((each) => each.name === "NEXT_LOCALE");
    expect(cookie?.value).toBe("en");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 300 * DAY);
  });

  test("unprefixed URLs follow the chosen language", async ({ page }) => {
    // The browser is Turkish (playwright.config.ts), so English comes from the cookie.
    await page.goto("/login");
    await expect(page).toHaveURL("/tr/login");
    await switcher(page, "English").click();
    await expect(page).toHaveURL("/en/login");

    for (const [from, to] of [["/login", "/en/login"], ["/register", "/en/register"]]) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to);
    }

    await switcher(page, "Türkçe").click();
    await expect(page).toHaveURL("/tr/register");
    await page.goto("/login");
    await expect(page).toHaveURL("/tr/login");
  });

  test("works with the keyboard", async ({ page }) => {
    await page.goto("/tr/login");
    await page.keyboard.press("Tab");
    await expect(switcher(page, "English")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/en/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("keeps the theme preference", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "dark"), THEME_KEY);
    await page.goto("/tr/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await switcher(page, "English").click();
    await expect(page).toHaveURL("/en/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveAccessibleName("Theme: Dark. Switch to system theme");
  });

  for (const width of [320, 375]) {
    test(`sits next to the theme toggle at ${width}px in both languages`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/tr/login", "/en/login", "/tr/register", "/en/register"]) {
        await page.goto(path);
        const name = path.startsWith("/tr") ? "English" : "Türkçe";
        await expect(switcher(page, name), path).toBeVisible();
        await expect(themeToggle(page), path).toBeVisible();
        const link = await switcher(page, name).boundingBox();
        const toggle = await themeToggle(page).boundingBox();
        expect(link, path).not.toBeNull();
        expect(toggle, path).not.toBeNull();
        // Same row, link first, both inside the viewport, full 44px targets.
        expect(Math.abs((link?.y ?? 0) - (toggle?.y ?? 0)), path).toBeLessThanOrEqual(1);
        expect((link?.x ?? 0) + (link?.width ?? 0), path).toBeLessThanOrEqual(toggle?.x ?? 0);
        expect(link?.x ?? -1, path).toBeGreaterThanOrEqual(0);
        expect((toggle?.x ?? 0) + (toggle?.width ?? 0), path).toBeLessThanOrEqual(width);
        expect(link?.height, path).toBeGreaterThanOrEqual(44);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);

        // Still usable at this width: the link switches the language.
        await switcher(page, name).click();
        await expect(page, path).not.toHaveURL(path);
      }
    });
  }
});
