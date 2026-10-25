import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

// Shared by the page specs. Not a spec itself (no .spec suffix).

// Every test fails if the page logs a console error or throws.
// Tests that open 404 pages on purpose set expectNotFoundDocument: the browser
// logs "Failed to load resource" for the 404 document itself, which is then
// ignored; a 404 for any other resource still fails the test.
// Tests that make the (mocked) API fail on purpose set expectApiErrors: the
// "Failed to load resource" logged for those /api/ requests is ignored.
export const test = base.extend<{
  consoleGuard: void;
  expectNotFoundDocument: boolean;
  expectApiErrors: boolean;
}>({
  expectNotFoundDocument: [false, { option: true }],
  expectApiErrors: [false, { option: true }],
  consoleGuard: [
    async ({ page, expectNotFoundDocument, expectApiErrors }, use) => {
      const problems: string[] = [];
      const notFoundDocuments = new Set<string>();
      const failedApiRequests = new Set<string>();
      const isApi = (url: string) => new URL(url).pathname.startsWith("/api/");
      page.on("response", (response) => {
        if (response.status() === 404 && response.request().resourceType() === "document") {
          notFoundDocuments.add(response.url());
        }
        if (response.status() >= 400 && isApi(response.url())) failedApiRequests.add(response.url());
      });
      page.on("requestfailed", (request) => {
        if (isApi(request.url())) failedApiRequests.add(request.url());
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const failedResource = message.text().startsWith("Failed to load resource:");
        const url = message.location().url;
        const isExpected404 = expectNotFoundDocument && failedResource && notFoundDocuments.has(url);
        const isExpectedApiError = expectApiErrors && failedResource && failedApiRequests.has(url);
        if (!isExpected404 && !isExpectedApiError) problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await use();
      expect(problems, "console errors / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// --- Auth API mock --------------------------------------------------------
// The UI specs run against the frontend only, so /api/auth/* is answered here
// (page.route). The real backend is covered by the backend's integration tests.

export const MOCK_CSRF_TOKEN = "test-csrf-token";

export const mockUser = (locale: "tr" | "en" = "tr") => ({
  id: "6f1c1e0a-1111-4c9b-9f1a-000000000001",
  email: "ayse@example.com",
  displayName: "Ayşe Yılmaz",
  locale,
  emailVerified: false,
});

// A reply: a status with a JSON body (problem details for errors), or "abort"
// for a network failure.
export type MockReply = { status: number; body?: unknown } | "abort";

export type ApiCall = { path: string; csrfToken: string | undefined; body: unknown };

// Answers register / login with the given replies, in order (the last one is
// repeated), and GET /api/auth/csrf with an XSRF-TOKEN cookie. `gate`, when
// given, holds every register / login reply until it resolves, so tests can
// observe the loading state. Returns the recorded calls.
export async function mockAuthApi(
  page: Page,
  replies: { register?: MockReply[]; login?: MockReply[] },
  gate?: Promise<void>,
) {
  const calls: ApiCall[] = [];
  await page.route("**/api/auth/csrf", (route) => {
    calls.push({ path: "/api/auth/csrf", csrfToken: undefined, body: undefined });
    return route.fulfill({
      status: 204,
      headers: { "set-cookie": `XSRF-TOKEN=${MOCK_CSRF_TOKEN}; Path=/` },
    });
  });
  for (const [name, queue] of Object.entries(replies)) {
    await page.route(`**/api/auth/${name}`, async (route) => {
      const request = route.request();
      calls.push({
        path: `/api/auth/${name}`,
        csrfToken: request.headers()["x-xsrf-token"],
        body: request.postDataJSON(),
      });
      const reply = queue.length > 1 ? queue.shift()! : queue[0];
      if (gate) await gate;
      if (reply === "abort") return route.abort("failed");
      return route.fulfill({
        status: reply.status,
        contentType: reply.status >= 400 ? "application/problem+json" : "application/json",
        body: JSON.stringify(reply.body ?? {}),
      });
    });
  }
  return calls;
}

// A problem-details error body, as the backend sends it.
export const problem = (status: number, code: string, errors?: { field: string; code: string }[]) => ({
  status,
  body: { type: "about:blank", title: "Error", status, code, ...(errors ? { errors } : {}) },
});

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
