import { useFormatter, useLocale, useTranslations, type Locale } from "next-intl";
import { comingSoonProps } from "@/components/app/coming-soon";
import { Card } from "@/components/ui/card";
import { NOW, pick, recommendedJobs, trending } from "./sample-data";

// Trending topics: plain text for now (topic pages do not exist yet).
export function Trending() {
  const t = useTranslations("feed.trending");
  const format = useFormatter();
  const locale = useLocale() as Locale;

  return (
    <section aria-labelledby="trending-heading">
      <Card padding="sm" className="space-y-3">
        <h2 id="trending-heading" className="font-display text-lg font-bold">
          {t("heading")}
        </h2>
        <ol className="space-y-2">
          {trending.map((topic) => (
            <li key={topic.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-semibold">{pick(topic.tag, locale)}</span>
              <span className="shrink-0 text-xs text-fg-muted">
                {t("posts", { count: format.number(topic.posts, { notation: "compact" }) })}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

// Job recommendations; the jobs page is still "coming soon".
export function JobRecommendations() {
  const t = useTranslations("feed");
  const tApp = useTranslations("app");
  const format = useFormatter();
  const locale = useLocale() as Locale;

  return (
    <section aria-labelledby="jobs-heading">
      <Card padding="sm" className="space-y-3">
        <h2 id="jobs-heading" className="font-display text-lg font-bold">
          {t("jobs.heading")}
        </h2>
        <ul className="divide-y divide-line">
          {recommendedJobs.map((job) => (
            <li key={job.id} className="py-3 first:pt-0">
              <p className="font-semibold leading-tight">{pick(job.role, locale)}</p>
              <p className="text-sm">{job.company}</p>
              <p className="text-xs text-fg-muted">
                {pick(job.location, locale)} · {t(`workMode.${job.workMode}`)} ·{" "}
                <time dateTime={job.createdAt.toISOString()}>{format.relativeTime(job.createdAt, NOW)}</time>
              </p>
            </li>
          ))}
        </ul>
        <button
          {...comingSoonProps}
          className="min-h-11 cursor-not-allowed text-sm font-semibold text-fg-muted"
        >
          {t("jobs.seeAll")} · {tApp("comingSoon")}
        </button>
      </Card>
    </section>
  );
}
