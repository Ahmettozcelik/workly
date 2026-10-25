import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getPathname } from "./navigation";
import { routing } from "./routing";
import { resolveSiteUrl } from "./site-url";

// Public origin, read when pages are built. A production build without a
// valid SITE_URL fails instead of publishing localhost or malformed URLs.
export const siteUrl = resolveSiteUrl(process.env.SITE_URL, process.env.NODE_ENV);

const absolute = (pathname: string) => new URL(pathname, siteUrl).toString();

// Canonical URL plus tr/en alternates for an indexable page. x-default is the
// unprefixed URL, which redirects to the visitor's language.
// Only for indexable pages: not the design-system page or 404 pages.
export function localeAlternates(
  locale: Locale,
  href: string,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const each of routing.locales) {
    languages[each] = absolute(getPathname({ locale: each, href }));
  }
  languages["x-default"] = absolute(href);

  return {
    canonical: absolute(getPathname({ locale, href })),
    languages,
  };
}
