"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Each language is named in itself, so these are not translated messages.
const LANGUAGE_NAME = { tr: "Türkçe", en: "English" } as const;

// Links the current page in the other language (/tr/login -> /en/login).
// A plain link: works without JavaScript, and next-intl updates the
// NEXT_LOCALE cookie on click so the choice is remembered (see routing.ts).
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "tr" ? "en" : "tr";

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      lang={other}
      className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-canvas"
    >
      {LANGUAGE_NAME[other]}
    </Link>
  );
}
