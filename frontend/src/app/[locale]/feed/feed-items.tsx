"use client";

import { useFormatter, useLocale, useTranslations, type Locale } from "next-intl";
import { useState, type ReactNode } from "react";
import { comingSoonProps } from "@/components/app/coming-soon";
import { BookmarkIcon, CommentIcon, HeartIcon, MapPinIcon, ShareIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { NOW, feedItems, pick, type FeedItem } from "./sample-data";

type Filter = "everyone" | "connections";

// The post feed with its "Everyone / My connections" filter. Likes and saves
// only change local state (prototype: nothing is stored or sent).
export function FeedItems() {
  const t = useTranslations("feed");
  const [filter, setFilter] = useState<Filter>("everyone");

  const items =
    filter === "everyone"
      ? feedItems
      : feedItems.filter((item) => item.kind === "post" && item.fromConnection);

  return (
    <section aria-labelledby="posts-heading" className="space-y-4">
      <h2 id="posts-heading" className="sr-only">
        {t("posts.heading")}
      </h2>

      <div role="group" aria-label={t("filter.label")} className="flex gap-2">
        {(["everyone", "connections"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
              filter === key
                ? "border-primary bg-primary text-primary-fg"
                : "border-line-strong bg-surface text-fg hover:bg-canvas",
            )}
          >
            {t(`filter.${key}`)}
          </button>
        ))}
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>{item.kind === "post" ? <PostCard post={item} /> : <JobPostCard job={item} />}</li>
        ))}
      </ul>
    </section>
  );
}

type Post = Extract<FeedItem, { kind: "post" }>;
type Job = Extract<FeedItem, { kind: "job" }>;

function PostCard({ post }: { post: Post }) {
  const t = useTranslations("feed.posts");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const headingId = `post-${post.id}-author`;

  return (
    <article aria-labelledby={headingId}>
      <Card padding="sm" className="space-y-3">
        <header className="flex items-start gap-3">
          <Avatar name={post.author.name} locale={locale} decorative />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id={headingId} className="font-semibold">
                {post.author.name}
              </h3>
              {post.fromConnection && <Badge variant="accent">{t("connection")}</Badge>}
            </div>
            <p className="text-sm text-fg-muted">{pick(post.author.title, locale)}</p>
            <p className="text-xs text-fg-muted">
              <time dateTime={post.createdAt.toISOString()}>{format.relativeTime(post.createdAt, NOW)}</time>
            </p>
          </div>
        </header>

        <p className="whitespace-pre-line">{pick(post.body, locale)}</p>

        <p className="text-xs text-fg-muted">
          {t("likes", { count: format.number(post.likes + (liked ? 1 : 0)) })} ·{" "}
          {t("comments", { count: format.number(post.comments) })}
        </p>

        <div className="grid grid-cols-4 gap-1 border-t border-line pt-2">
          <ActionButton pressed={liked} onClick={() => setLiked(!liked)} label={t("like")}>
            <HeartIcon filled={liked} />
          </ActionButton>
          <ActionButton label={t("comment")}>
            <CommentIcon />
          </ActionButton>
          <ActionButton label={t("share")}>
            <ShareIcon />
          </ActionButton>
          <ActionButton pressed={saved} onClick={() => setSaved(!saved)} label={t("save")}>
            <BookmarkIcon filled={saved} />
          </ActionButton>
        </div>
      </Card>
    </article>
  );
}

// A toggle (pressed + onClick) or, without onClick, a "coming soon" placeholder.
// Labels are visually hidden below sm, where only the icons fit.
function ActionButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className =
    "flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-1 text-sm font-medium transition-colors";
  if (!onClick) {
    return (
      <button {...comingSoonProps} className={cn(className, "cursor-not-allowed text-fg-muted")}>
        {children}
        <span className="max-sm:sr-only">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(className, pressed ? "text-accent-text" : "text-fg", "hover:bg-canvas")}
    >
      {children}
      <span className="max-sm:sr-only">{label}</span>
    </button>
  );
}

function JobPostCard({ job }: { job: Job }) {
  const t = useTranslations("feed");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const [saved, setSaved] = useState(false);
  const headingId = `job-${job.id}-role`;

  return (
    <article aria-labelledby={headingId}>
      <Card padding="sm" className="space-y-3 border-s-4 border-s-accent">
        <Badge variant="accent">{t("posts.jobLabel")}</Badge>
        <div>
          <h3 id={headingId} className="font-display text-lg font-bold leading-tight">
            {pick(job.role, locale)}
          </h3>
          <p className="text-sm">{job.company}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
            <MapPinIcon className="size-4" />
            <span>{pick(job.location, locale)}</span>
            <span aria-hidden="true">·</span>
            <span>{t(`workMode.${job.workMode}`)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={job.createdAt.toISOString()}>{format.relativeTime(job.createdAt, NOW)}</time>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button {...comingSoonProps} className={buttonClasses({ className: "cursor-not-allowed" })}>
            {t("posts.apply")}
          </button>
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => setSaved(!saved)}
            className={buttonClasses({ variant: "secondary" })}
          >
            <BookmarkIcon filled={saved} className="size-4" />
            {t("posts.saveJob")}
          </button>
        </div>
      </Card>
    </article>
  );
}
