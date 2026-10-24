import { defineRouting } from "next-intl/routing";

// Every URL carries its locale (/tr/..., /en/...). Unprefixed URLs are
// redirected by src/proxy.ts using Accept-Language, falling back to Turkish.
export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  localePrefix: "always",
  // Persisting the chosen language arrives with the language switcher.
  localeCookie: false,
});
