import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The Spring Boot API. The browser only talks to this Next.js origin: /api is
// proxied, so session and CSRF cookies are first-party and no CORS is needed.
// Read when the routes are built: set BACKEND_URL at build time in production.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

// Security headers for every response except /api (the Spring Boot API sends
// its own). The CSP has frame-ancestors only: it forbids framing and restricts
// nothing else. A full CSP (nonces) is not set; when one is added, this
// directive must move into that single policy. HSTS belongs to the reverse
// proxy in front (deployment).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!api(?:/|$)).*)", headers: securityHeaders },
      // The reset link carries its token in the URL: never send it on as a
      // Referer (the later rule wins for the same header).
      { source: "/:locale(tr|en)/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Picks up the request config from src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
