import type { APIResponse } from "@playwright/test";
import { expect, test } from "./support";

// Security headers from next.config.ts on every response except /api, which
// the Spring Boot API answers with its own (here: the mock backend, which sends
// none, so anything found there would have been added by Next.js).

const EXPECTED = {
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

// Exact values: a duplicated header would read "DENY, DENY".
function expectSecurityHeaders(response: APIResponse, label: string) {
  const headers = response.headers();
  for (const [name, value] of Object.entries(EXPECTED)) {
    expect(headers[name], `${label}: ${name}`).toBe(value);
  }
  expect(headers["x-powered-by"], `${label}: x-powered-by`).toBeUndefined();
}

test.describe("security headers", () => {
  test("the root redirect to /tr carries them", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/tr");
    expectSecurityHeaders(response, "/");
  });

  test("pages in both languages carry them", async ({ request }) => {
    for (const path of ["/tr", "/tr/login", "/tr/register", "/en/login", "/en/register"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      expectSecurityHeaders(response, path);
    }
  });

  test("the protected feed's redirect to login carries them", async ({ request }) => {
    const response = await request.get("/tr/feed", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/tr/login");
    expectSecurityHeaders(response, "/tr/feed");
  });

  test("404 responses carry them", async ({ request }) => {
    for (const path of ["/tr/does-not-exist", "/en/does-not-exist"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expectSecurityHeaders(response, path);
    }
  });

  test("static files carry them", async ({ request }) => {
    const html = await (await request.get("/tr/login")).text();
    const script = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
    expect(script, "a /_next/static script in the page").toBeTruthy();
    for (const path of [script!, "/favicon.ico"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expectSecurityHeaders(response, path);
    }
  });

  test("/api is left to the backend", async ({ request }) => {
    const response = await request.get("/api/auth/csrf");
    expect(response.status()).toBe(204);
    const headers = response.headers();
    for (const name of Object.keys(EXPECTED)) {
      expect(headers[name], `/api: ${name}`).toBeUndefined();
    }
    expect(headers["x-powered-by"], "/api: x-powered-by").toBeUndefined();
  });
});
