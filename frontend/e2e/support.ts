import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

// Shared by the page specs. Not a spec itself (no .spec suffix).

// Every test fails if the page logs a console error or throws.
// Tests that open 404 pages on purpose set expectNotFoundDocument: the browser
// logs "Failed to load resource" for the 404 document itself, which is then
// ignored; a 404 for any other resource still fails the test.
// Tests that make the (mocked) API fail on purpose set expectApiErrors: the
// "Failed to load resource" logged for those /api/ requests is ignored.
// Tests that make a server render fail on purpose (error.tsx) set
// expectServerError: the 5xx document's "Failed to load resource" and React's
// production report of a Server Components error (#441, details omitted) are
// ignored; any other error still fails the test.
export const test = base.extend<{
  consoleGuard: void;
  expectNotFoundDocument: boolean;
  expectApiErrors: boolean;
  expectServerError: boolean;
}>({
  expectNotFoundDocument: [false, { option: true }],
  expectApiErrors: [false, { option: true }],
  expectServerError: [false, { option: true }],
  consoleGuard: [
    async ({ page, expectNotFoundDocument, expectApiErrors, expectServerError }, use) => {
      const problems: string[] = [];
      const notFoundDocuments = new Set<string>();
      const serverErrorDocuments = new Set<string>();
      const failedApiRequests = new Set<string>();
      const isApi = (url: string) => new URL(url).pathname.startsWith("/api/");
      page.on("response", (response) => {
        const isDocument = response.request().resourceType() === "document";
        if (response.status() === 404 && isDocument) notFoundDocuments.add(response.url());
        if (response.status() >= 500 && isDocument) serverErrorDocuments.add(response.url());
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
        const isExpectedServerError =
          expectServerError &&
          ((failedResource && serverErrorDocuments.has(url)) ||
            message.text().startsWith("Error: Minified React error #441;"));
        if (!isExpected404 && !isExpectedApiError && !isExpectedServerError) problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await use();
      expect(problems, "console errors / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// --- Sessions -------------------------------------------------------------
// The session check runs on the Next.js server against the mock backend
// (e2e/mock-backend.mjs), which decides by the WORKLY_SESSION cookie value.

export const SESSION_COOKIE = "WORKLY_SESSION";

// The member the mock backend returns for a valid session.
export const SIGNED_IN = { name: "Deniz Arslan", email: "deniz.arslan@example.com" };

export type MockSession = "valid-tr" | "valid-en" | "verified" | "expired" | "backend-error" | "logout-error";

// Puts a session cookie in the browser, as the backend would after sign-in.
export async function signIn(context: BrowserContext, baseURL: string, session: MockSession = "valid-tr") {
  await context.addCookies([
    { name: SESSION_COOKIE, value: session, url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
}

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

// A reply: a status with a JSON body (problem details for errors) and optional
// extra headers (e.g. Retry-After), or "abort" for a network failure.
export type MockReply = { status: number; body?: unknown; headers?: Record<string, string> } | "abort";

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
      // Like the backend, a successful login starts a session (register does
      // not); the mock backend then answers the feed's session check for it.
      const locale = (reply.body as { locale?: string } | undefined)?.locale ?? "tr";
      return route.fulfill({
        status: reply.status,
        contentType: reply.status >= 400 ? "application/problem+json" : "application/json",
        headers: {
          ...(name === "login" && reply.status < 300
            ? { "set-cookie": `${SESSION_COOKIE}=valid-${locale}; Path=/; HttpOnly; SameSite=Lax` }
            : {}),
          ...reply.headers,
        },
        body: reply.body === undefined ? "" : JSON.stringify(reply.body),
      });
    });
  }
  return calls;
}

// The backend's answer to every valid registration: 202, no body, no session.
export const registered: MockReply = { status: 202 };

export type EndpointCall = { body: unknown; csrfToken: string | undefined };

// Answers POST /api/auth/{name} with the given replies in order (the last one
// repeats). Bodyless replies (202, 204) are sent without a body. Returns the calls.
export async function mockEndpoint(page: Page, name: string, replies: MockReply[]) {
  const calls: EndpointCall[] = [];
  await page.route(`**/api/auth/${name}`, async (route) => {
    calls.push({ body: route.request().postDataJSON(), csrfToken: route.request().headers()["x-xsrf-token"] });
    const reply = replies.length > 1 ? replies.shift()! : replies[0];
    if (reply === "abort") return route.abort("failed");
    return route.fulfill({
      status: reply.status,
      contentType: "application/problem+json",
      headers: reply.headers,
      body: reply.body === undefined ? "" : JSON.stringify(reply.body),
    });
  });
  return calls;
}

// 429 RATE_LIMITED, as the backend sends it; Retry-After in seconds unless omitted.
export const rateLimited = (retryAfterSeconds?: number): MockReply => ({
  ...problem(429, "RATE_LIMITED"),
  ...(retryAfterSeconds === undefined ? {} : { headers: { "retry-after": String(retryAfterSeconds) } }),
});

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
