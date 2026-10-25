import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { BottomNav, SidebarNav, type NavItemKey } from "./app-nav";
import { COMING_SOON_ID, comingSoonProps } from "./coming-soon";
import { SearchIcon } from "./icons";

type AppShellProps = {
  /** Highlighted navigation item. */
  current: NavItemKey;
  /** Signed-in member shown in the header. */
  viewerName: string;
  /** Left column above the navigation (e.g. the profile summary). */
  sidebar: ReactNode;
  /** Right column; below the main content under lg. */
  aside: ReactNode;
  /** Accessible name of the right column. */
  asideLabel: string;
  children: ReactNode;
};

// Layout of the signed-in pages: header, left column (sidebar + navigation),
// main content and right column. Three columns from lg, two from md (the right
// column moves under the main content), one below md with a bottom tab bar.
export function AppShell({
  current,
  viewerName,
  sidebar,
  aside,
  asideLabel,
  children,
}: AppShellProps) {
  const t = useTranslations("app");
  const locale = useLocale();

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-30 rounded-control bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("skipToContent")}
      </a>
      <span id={COMING_SOON_ID} hidden>
        {t("comingSoon")}
      </span>

      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link href="/feed" className="shrink-0 rounded-control">
            <Logo />
          </Link>
          <Badge className="max-sm:hidden">{t("prototypeBadge")}</Badge>

          <div className="flex flex-1 justify-end md:justify-center">
            <button
              {...comingSoonProps}
              aria-label={t("search")}
              className="flex size-11 cursor-not-allowed items-center justify-center gap-2 rounded-control border border-line-strong text-sm text-fg-muted max-sm:hidden md:w-full md:max-w-sm md:justify-start md:px-3"
            >
              <SearchIcon />
              <span className="truncate max-md:hidden">{t("search")}</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Avatar name={viewerName} locale={locale} size="sm" className="max-sm:hidden" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-4 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6 md:pb-10 lg:grid-cols-[15rem_minmax(0,1fr)_18rem]">
        <div className="space-y-4 md:sticky md:top-22 md:row-span-2 md:self-start lg:row-span-1">
          {sidebar}
          <SidebarNav current={current} />
        </div>

        <main id="main-content" tabIndex={-1} className="min-w-0 space-y-4">
          {children}
        </main>

        <aside
          aria-label={asideLabel}
          className="min-w-0 space-y-4 md:col-start-2 lg:sticky lg:top-22 lg:col-start-3 lg:row-start-1 lg:self-start"
        >
          {aside}
        </aside>
      </div>

      <BottomNav current={current} />
    </div>
  );
}
