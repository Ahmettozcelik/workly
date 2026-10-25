import { useLocale, useTranslations } from "next-intl";
import { comingSoonProps } from "@/components/app/coming-soon";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { viewer } from "./sample-data";

// PLACEHOLDER: posting does not exist yet. A single "coming soon" control that
// looks like the composer, so the layout is final without extra tab stops.
export function PostComposer() {
  const t = useTranslations("feed.composer");
  const tApp = useTranslations("app");
  const locale = useLocale();

  return (
    <section aria-labelledby="composer-heading">
      <h2 id="composer-heading" className="sr-only">
        {t("heading")}
      </h2>
      <Card padding="sm" className="flex items-center gap-3">
        <Avatar name={viewer.name} locale={locale} decorative />
        <button
          {...comingSoonProps}
          className="flex min-h-11 min-w-0 flex-1 cursor-not-allowed items-center justify-between gap-2 rounded-full border border-line-strong px-4 text-start text-sm text-fg-muted"
        >
          <span className="truncate">{t("placeholder")}</span>
          <Badge aria-hidden="true">{tApp("comingSoonShort")}</Badge>
        </button>
      </Card>
    </section>
  );
}
