import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { AXE_TAGS, expect, test } from "./support";

const COPY = {
  tr: {
    path: "/tr/feed",
    title: "Akış · Workly",
    heading: "Akış",
    nav: "Ana navigasyon",
    aside: "Öneriler ve gündem",
    home: "Ana sayfa",
    soon: ["Ağım", "İşler", "Mesajlar", "Bildirimler"],
    comingSoon: "Yakında",
    skip: "İçeriğe geç",
    everyone: "Herkes",
    connections: "Bağlantılarım",
    like: "Beğen",
    save: "Kaydet",
    likes: (n: number) => `${n} beğeni`,
    time: "2 saat önce",
    connectMert: "Mert Kaya ile bağlan",
    sentMert: "İstek gönderildi: Mert Kaya",
    sent: "İstek gönderildi",
    announcement: "Mert Kaya kişisine bağlantı isteği gönderildi",
    switcher: "English",
    otherPath: "/en/feed",
  },
  en: {
    path: "/en/feed",
    title: "Feed · Workly",
    heading: "Feed",
    nav: "Main navigation",
    aside: "Suggestions and trends",
    home: "Home",
    soon: ["My network", "Jobs", "Messages", "Notifications"],
    comingSoon: "Coming soon",
    skip: "Skip to content",
    everyone: "Everyone",
    connections: "My connections",
    like: "Like",
    save: "Save",
    likes: (n: number) => `${n} likes`,
    time: "2 hours ago",
    connectMert: "Connect with Mert Kaya",
    sentMert: "Request sent: Mert Kaya",
    sent: "Request sent",
    announcement: "Connection request sent to Mert Kaya",
    switcher: "Türkçe",
    otherPath: "/tr/feed",
  },
} as const;
type Copy = (typeof COPY)[keyof typeof COPY];

// Only the visible navigation (sidebar from md, bottom bar below) is in the
// accessibility tree, so the role query finds exactly one.
const mainNav = (page: Page, c: Copy) => page.getByRole("navigation", { name: c.nav });
const firstPost = (page: Page) => page.getByRole("article", { name: "Can Şahin" });
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

for (const [lang, c] of Object.entries(COPY) as [keyof typeof COPY, Copy][]) {
  test.describe(`feed (${lang})`, () => {
    test("has title, landmarks and headings, and is not indexed", async ({ page }) => {
      await page.goto(c.path);
      await expect(page).toHaveTitle(c.title);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);

      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(mainNav(page, c)).toBeVisible();
      await expect(page.getByRole("complementary", { name: c.aside })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: c.heading })).toBeAttached();
      await expect(page.getByRole("heading", { level: 2, name: "Ayşe Yılmaz" })).toBeVisible();
      await expect(page.getByRole("article")).toHaveCount(4);
      await expect(firstPost(page).getByText(c.time)).toBeVisible();
    });

    test("navigation marks home as current and the rest as coming soon", async ({ page }) => {
      await page.goto(c.path);
      const nav = mainNav(page, c);
      await expect(nav.getByRole("link", { name: c.home })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: c.home })).toHaveAttribute("href", c.path);
      for (const name of c.soon) {
        const item = nav.getByRole("button", { name });
        await expect(item, name).toHaveAttribute("aria-disabled", "true");
        await expect(item, name).toHaveAccessibleDescription(c.comingSoon);
      }
    });

    test("the language switcher keeps the feed", async ({ page }) => {
      await page.goto(c.path);
      await expect(page.getByRole("link", { name: c.switcher, exact: true })).toHaveAttribute("href", c.otherPath);
    });

    test("filters the feed to connections and back", async ({ page }) => {
      await page.goto(c.path);
      const everyone = page.getByRole("button", { name: c.everyone });
      const connections = page.getByRole("button", { name: c.connections });
      await expect(everyone).toHaveAttribute("aria-pressed", "true");

      await connections.click();
      await expect(connections).toHaveAttribute("aria-pressed", "true");
      await expect(everyone).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByRole("article")).toHaveCount(2);
      await expect(page.getByRole("article", { name: "Elif Demir" })).toHaveCount(0);

      await everyone.click();
      await expect(page.getByRole("article")).toHaveCount(4);
    });

    test("like and save toggle locally", async ({ page }) => {
      await page.goto(c.path);
      const post = firstPost(page);
      const like = post.getByRole("button", { name: c.like });
      await expect(post.getByText(c.likes(42))).toBeVisible();

      await like.click();
      await expect(like).toHaveAttribute("aria-pressed", "true");
      await expect(post.getByText(c.likes(43))).toBeVisible();
      await like.click();
      await expect(like).toHaveAttribute("aria-pressed", "false");
      await expect(post.getByText(c.likes(42))).toBeVisible();

      const save = post.getByRole("button", { name: c.save });
      await save.click();
      await expect(save).toHaveAttribute("aria-pressed", "true");
    });

    test("connect sends a request, keeps focus and announces it", async ({ page }) => {
      await page.goto(c.path);
      const button = page.getByRole("button", { name: c.connectMert });
      await button.click();

      const sent = page.getByRole("button", { name: c.sentMert });
      await expect(sent).toHaveText(c.sent);
      await expect(sent).toHaveAttribute("aria-disabled", "true");
      await expect(sent).toBeFocused();
      await expect(page.getByText(c.announcement)).toBeAttached();

      // Activating it again changes nothing. (Keyboard: Playwright will not
      // click an aria-disabled button.)
      await sent.press("Enter");
      await expect(sent).toHaveText(c.sent);
      await expect(page.getByRole("button", { name: c.connectMert })).toHaveCount(0);
    });

    for (const scheme of ["light", "dark"] as const) {
      test(`has no axe violations in the ${scheme} theme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(c.path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
        const scan = async () => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;
        expect(await scan()).toEqual([]);

        // After interactions too (pressed states, "request sent").
        await firstPost(page).getByRole("button", { name: c.like }).click();
        await page.getByRole("button", { name: c.connectMert }).click();
        expect(await scan()).toEqual([]);
      });
    }
  });
}

test.describe("feed keyboard", () => {
  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/tr/feed");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "İçeriğe geç" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("Tab order follows the visual order", async ({ page }) => {
    await page.goto("/tr/feed");
    const banner = page.getByRole("banner");
    const expected = [
      page.getByRole("link", { name: "İçeriğe geç" }),
      banner.getByRole("link", { name: "Workly" }),
      ...(isDesktop(page) ? [banner.getByRole("button", { name: "Kişi, iş veya konu ara" })] : []),
      banner.getByRole("link", { name: "English" }),
      banner.getByRole("button", { name: /^Tema:/ }),
      ...(isDesktop(page)
        ? [
            page.getByRole("button", { name: "Profili tamamla" }),
            mainNav(page, COPY.tr).getByRole("link", { name: "Ana sayfa" }),
          ]
        : []),
    ];
    for (const target of expected) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
    }
  });
});

test.describe("feed responsive", () => {
  for (const width of [320, 375, 768, 1024, 1280]) {
    test(`no horizontal overflow at ${width}px, with the right navigation`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/tr/feed", "/en/feed"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);

        const nav = page.getByRole("navigation", { name: path.startsWith("/tr") ? "Ana navigasyon" : "Main navigation" });
        const navBox = await nav.boundingBox();
        const viewport = 900;
        // Bottom tab bar below md, sidebar from md.
        if (width < 768) expect((navBox?.y ?? 0) + (navBox?.height ?? 0), path).toBeCloseTo(viewport, 0);
        else expect(navBox?.y ?? viewport, path).toBeLessThan(viewport);
      }
    });
  }

  test("three columns from lg, the right column under the feed at md", async ({ page }) => {
    const box = async (role: "main" | "complementary") => (await page.getByRole(role).boundingBox())!;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/tr/feed");
    expect((await box("complementary")).x).toBeGreaterThan((await box("main")).x);

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/tr/feed");
    const main = await box("main");
    const aside = await box("complementary");
    expect(aside.x).toBeCloseTo(main.x, 0);
    expect(aside.y).toBeGreaterThan(main.y + main.height - 1);
  });
});
