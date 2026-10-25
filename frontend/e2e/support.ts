import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

// Shared by the page specs. Not a spec itself (no .spec suffix).

// Every test fails if the page logs a console error or throws.
// Tests that open 404 pages on purpose set expectNotFoundDocument: the browser
// logs "Failed to load resource" for the 404 document itself, which is then
// ignored; a 404 for any other resource still fails the test.
export const test = base.extend<{ consoleGuard: void; expectNotFoundDocument: boolean }>({
  expectNotFoundDocument: [false, { option: true }],
  consoleGuard: [
    async ({ page, expectNotFoundDocument }, use) => {
      const problems: string[] = [];
      const notFoundDocuments = new Set<string>();
      page.on("response", (response) => {
        if (response.status() === 404 && response.request().resourceType() === "document") {
          notFoundDocuments.add(response.url());
        }
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const isExpected404 =
          expectNotFoundDocument &&
          message.text().startsWith("Failed to load resource:") &&
          notFoundDocuments.has(message.location().url);
        if (!isExpected404) problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await use();
      expect(problems, "console errors / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export const THEME_KEY = "workly-theme";

export const isDesktop = (width: number) => width >= 1024;

// Photos are identified by their bytes, not by (hashed) URLs or DOM order.
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const PHOTO_DIR = join(__dirname, "../src/components/auth/images");
const PHOTO_BY_HASH: Record<string, "light" | "dark"> = {
  [sha256(readFileSync(join(PHOTO_DIR, "Workly-Light.jpg")))]: "light",
  [sha256(readFileSync(join(PHOTO_DIR, "Workly-Dark.jpg")))]: "dark",
};
// The panel photos load through the Next.js optimiser: /_next/image?url=<asset>&...
export const isPhotoRequest = (url: string) => new URL(url).pathname === "/_next/image";

// Fetches the original asset behind an optimiser URL and names it by its bytes.
export async function photoBehind(page: Page, optimiserUrl: string) {
  const asset = new URL(optimiserUrl, page.url()).searchParams.get("url");
  const response = await page.request.get(asset ?? "");
  return PHOTO_BY_HASH[sha256(await response.body())] ?? `unknown asset: ${asset}`;
}

// Which photo the visible brand-panel layer shows (exactly one layer is visible).
export async function visiblePhoto(page: Page) {
  const layer = page.locator('aside [style*="image-set"]').filter({ visible: true });
  await expect(layer).toHaveCount(1);
  const style = (await layer.getAttribute("style")) ?? "";
  const firstUrl = style.match(/url\("([^"]+)"\)/)?.[1] ?? "";
  return photoBehind(page, firstUrl);
}
