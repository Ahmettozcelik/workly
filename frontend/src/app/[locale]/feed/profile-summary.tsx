import { useFormatter, useLocale, useTranslations, type Locale } from "next-intl";
import { comingSoonProps } from "@/components/app/coming-soon";
import { VerifiedIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pick, viewer } from "./sample-data";

// The signed-in member: identity, work-email verification, a few numbers and
// how complete the profile is (Workly's "one account, verify, then grow" path).
export function ProfileSummary() {
  const t = useTranslations("feed.profile");
  const format = useFormatter();
  const locale = useLocale() as Locale;

  return (
    <section aria-labelledby="profile-summary-heading">
      {/* flex gap (not space-y), so the blocks hidden below md leave no gap. */}
      <Card padding="sm" className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={viewer.name} locale={locale} size="lg" decorative />
          <div className="min-w-0">
            <h2 id="profile-summary-heading" className="font-display text-lg font-bold leading-tight">
              {viewer.name}
            </h2>
            <p className="text-sm text-fg-muted">{pick(viewer.title, locale)}</p>
          </div>
        </div>

        {viewer.workEmailVerified && (
          <Badge variant="success" className="self-start">
            <VerifiedIcon className="size-4" />
            {t("verified")}
          </Badge>
        )}

        {/* Below md only the identity shows, so the feed starts on the first screen. */}
        <dl className="grid grid-cols-2 gap-2 border-t border-line pt-4 text-center max-md:hidden">
          <div>
            <dt className="text-xs text-fg-muted">{t("connections")}</dt>
            <dd className="font-display text-xl font-bold">{format.number(viewer.connections)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t("profileViews")}</dt>
            <dd className="font-display text-xl font-bold">{format.number(viewer.profileViews)}</dd>
          </div>
        </dl>

        <div className="space-y-2 border-t border-line pt-4 max-md:hidden">
          <p id="profile-completion-label" className="text-sm font-semibold">
            {t("completion", { percent: viewer.profileCompletion })}
          </p>
          <div
            role="progressbar"
            aria-labelledby="profile-completion-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={viewer.profileCompletion}
            className="h-2 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${viewer.profileCompletion}%` }} />
          </div>
          <p className="text-sm text-fg-muted">{t("nextStep", { step: pick(viewer.nextStep, locale) })}</p>
          <button
            {...comingSoonProps}
            className={buttonClasses({ variant: "secondary", fullWidth: true, className: "cursor-not-allowed" })}
          >
            {t("complete")}
          </button>
        </div>
      </Card>
    </section>
  );
}
