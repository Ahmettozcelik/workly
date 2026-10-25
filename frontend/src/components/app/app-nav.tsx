import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { comingSoonProps } from "./coming-soon";
import { BellIcon, HomeIcon, JobsIcon, MessagesIcon, NetworkIcon } from "./icons";

export type NavItemKey = "home" | "network" | "jobs" | "messages" | "notifications";

// href: the item's page; null while it is still a "coming soon" placeholder.
const NAV_ITEMS: { key: NavItemKey; href: string | null; icon: ComponentType<{ className?: string }> }[] = [
  { key: "home", href: "/feed", icon: HomeIcon },
  { key: "network", href: null, icon: NetworkIcon },
  { key: "jobs", href: null, icon: JobsIcon },
  { key: "messages", href: null, icon: MessagesIcon },
  { key: "notifications", href: null, icon: BellIcon },
];

type AppNavProps = { current: NavItemKey };

// Main navigation as a card in the left column (md and up).
export function SidebarNav({ current }: AppNavProps) {
  const t = useTranslations("app");

  return (
    <nav aria-label={t("nav.label")} className="hidden md:block">
      <Card padding="sm" className="p-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const className =
              "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-start text-sm font-medium";
            return (
              <li key={key}>
                {href ? (
                  <Link
                    href={href}
                    aria-current={key === current ? "page" : undefined}
                    className={cn(
                      className,
                      key === current
                        ? "bg-primary font-semibold text-primary-fg"
                        : "text-fg hover:bg-canvas",
                    )}
                  >
                    <Icon />
                    {t(`nav.${key}`)}
                  </Link>
                ) : (
                  <button {...comingSoonProps} className={cn(className, "cursor-not-allowed text-fg-muted")}>
                    <Icon />
                    <span className="min-w-0 flex-1">{t(`nav.${key}`)}</span>
                    <Badge aria-hidden="true">{t("comingSoonShort")}</Badge>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </nav>
  );
}

// The same navigation as a bottom tab bar below md. Below 360px the five
// labels do not fit, so they are visually hidden (still the accessible names).
export function BottomNav({ current }: AppNavProps) {
  const t = useTranslations("app");

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const className =
            "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[0.6875rem] leading-tight font-medium";
          const label = <span className="max-[359px]:sr-only">{t(`nav.${key}`)}</span>;
          return (
            <li key={key} className="min-w-0">
              {href ? (
                <Link
                  href={href}
                  aria-current={key === current ? "page" : undefined}
                  className={cn(className, key === current ? "text-accent-text" : "text-fg")}
                >
                  <Icon />
                  {label}
                </Link>
              ) : (
                <button {...comingSoonProps} className={cn(className, "cursor-not-allowed text-fg-muted")}>
                  <Icon />
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
