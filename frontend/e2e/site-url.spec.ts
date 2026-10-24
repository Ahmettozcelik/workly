import { expect, test } from "@playwright/test";
import { resolveSiteUrl } from "../src/i18n/site-url";

// Pure checks of SITE_URL resolution; no browser or server needed.

test.describe("SITE_URL", () => {
  test("accepts bare http(s) origins and normalizes them", () => {
    const valid: [string, string][] = [
      ["https://example.com", "https://example.com/"],
      ["https://example.com/", "https://example.com/"],
      ["http://localhost:3100", "http://localhost:3100/"],
      ["https://example.com:8443", "https://example.com:8443/"],
      ["https://example.com:443", "https://example.com/"],
      ["HTTPS://Example.COM", "https://example.com/"],
      ["  https://example.com  ", "https://example.com/"],
    ];
    for (const [value, expected] of valid) {
      for (const nodeEnv of ["production", "development"]) {
        expect(resolveSiteUrl(value, nodeEnv).href, `${value} (${nodeEnv})`).toBe(expected);
      }
    }
  });

  test("keeps canonical URL composition unchanged for a valid origin", () => {
    const origin = resolveSiteUrl("https://example.com", "production");
    expect(new URL("/tr/register", origin).toString()).toBe("https://example.com/tr/register");
    expect(new URL("/register", origin).toString()).toBe("https://example.com/register");
    expect(new URL("/", origin).toString()).toBe("https://example.com/");
  });

  test("falls back to localhost only outside production", () => {
    for (const value of [undefined, ""]) {
      expect(resolveSiteUrl(value, "development").href).toBe("http://localhost:3000/");
      expect(resolveSiteUrl(value, "test").href).toBe("http://localhost:3000/");
      expect(resolveSiteUrl(value, undefined).href).toBe("http://localhost:3000/");
      expect(() => resolveSiteUrl(value, "production")).toThrow(
        "SITE_URL is not set. Set it to the public origin (e.g. https://example.com) for production builds.",
      );
    }
  });

  const invalid: [string, string][] = [
    ["no scheme", "example.com"],
    ["not a URL", "not a url"],
    ["missing host", "https://"],
    ["ftp", "ftp://example.com"],
    ["javascript", "javascript:alert(1)"],
    ["file", "file:///etc/passwd"],
    ["mailto", "mailto:admin@example.com"],
    ["data", "data:text/plain,hello"],
    ["username and password", "https://user:secret@example.com"],
    ["username only", "https://user@example.com"],
    ["path", "https://example.com/app"],
    ["path with trailing slash", "https://example.com/app/"],
    ["query string", "https://example.com/?utm=x"],
    ["fragment", "https://example.com/#top"],
  ];

  // Fixed messages: nothing from the (possibly secret) input can leak into them.
  const REJECTIONS = [
    "SITE_URL is not a valid URL. Use a bare origin such as https://example.com.",
    "SITE_URL must be a bare http(s) origin such as https://example.com (no credentials, path, query or fragment).",
  ];

  for (const [label, value] of invalid) {
    test(`rejects ${label} without echoing the value`, () => {
      for (const nodeEnv of ["production", "development"]) {
        let message = "(not rejected)";
        try {
          resolveSiteUrl(value, nodeEnv);
        } catch (error) {
          message = (error as Error).message;
        }
        expect(REJECTIONS, `${label} (${nodeEnv}): ${message}`).toContain(message);
      }
    });
  }
});
