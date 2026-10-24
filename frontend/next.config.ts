import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
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
