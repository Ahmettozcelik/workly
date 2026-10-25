import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The Spring Boot API. The browser only talks to this Next.js origin: /api is
// proxied, so session and CSRF cookies are first-party and no CORS is needed.
// Read when the routes are built: set BACKEND_URL at build time in production.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
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
