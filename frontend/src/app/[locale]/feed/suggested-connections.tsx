"use client";

import { useFormatter, useLocale, useTranslations, type Locale } from "next-intl";
import { useState } from "react";
import { comingSoonProps } from "@/components/app/coming-soon";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pick, suggestions } from "./sample-data";

// "Connect" turns into "Request sent" (local state only) and is announced in a
// polite live region. The button keeps focus: aria-disabled, not disabled.
export function SuggestedConnections() {
  const t = useTranslations("feed.suggestions");
  const tApp = useTranslations("app");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const [sent, setSent] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  function connect(id: string, name: string) {
    if (sent.includes(id)) return;
    setSent([...sent, id]);
    setAnnouncement(t("sentAnnouncement", { name }));
  }

  return (
    <section aria-labelledby="suggestions-heading">
      <Card padding="sm" className="space-y-4">
        <h2 id="suggestions-heading" className="font-display text-lg font-bold">
          {t("heading")}
        </h2>
        <ul className="space-y-4">
          {suggestions.map((person) => {
            const isSent = sent.includes(person.id);
            return (
              <li key={person.id} className="flex items-start gap-3">
                <Avatar name={person.name} locale={locale} decorative />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-semibold leading-tight">{person.name}</p>
                    <p className="text-sm text-fg-muted">{pick(person.title, locale)}</p>
                    <p className="text-xs text-fg-muted">
                      {t("mutual", { count: format.number(person.mutual) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => connect(person.id, person.name)}
                    aria-disabled={isSent || undefined}
                    aria-label={isSent ? t("sentTo", { name: person.name }) : t("connectWith", { name: person.name })}
                    className={buttonClasses({
                      variant: isSent ? "secondary" : "primary",
                      className: isSent ? "cursor-default" : undefined,
                    })}
                  >
                    {isSent ? t("sent") : t("connect")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          {...comingSoonProps}
          className="min-h-11 cursor-not-allowed text-sm font-semibold text-fg-muted"
        >
          {t("seeAll")} · {tApp("comingSoon")}
        </button>
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </Card>
    </section>
  );
}
