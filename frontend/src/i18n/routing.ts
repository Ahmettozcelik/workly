import { defineRouting } from "next-intl/routing";

// Every URL carries its locale (/tr/..., /en/...). Unprefixed URLs are
// redirected by src/proxy.ts: to the NEXT_LOCALE cookie's language, else
// Accept-Language, else Turkish.
export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  localePrefix: "always",
  // NEXT_LOCALE remembers the last language used (switcher or a prefixed URL),
  // so unprefixed URLs return to it. Kept for a year instead of the session.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
  // hreflang is declared in page metadata (src/i18n/metadata.ts), only on
  // indexable pages; no automatic HTTP Link header on every response.
  alternateLinks: false,
});
