import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app/app-shell";
import { routing } from "@/i18n/routing";
import { FeedItems } from "./feed-items";
import { PostComposer } from "./post-composer";
import { ProfileSummary } from "./profile-summary";
import { viewer } from "./sample-data";
import { JobRecommendations, Trending } from "./side-panels";
import { SuggestedConnections } from "./suggested-connections";

// A signed-in member's page: not indexed, so no canonical or hreflang.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/feed">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "feed.meta" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

// PROTOTYPE: sample data only (sample-data.ts); no session, API or storage.
export default async function FeedPage({ params }: PageProps<"/[locale]/feed">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Keeps the page static (no request headers needed to read the locale).
  setRequestLocale(locale);

  return <Feed />;
}

function Feed() {
  const t = useTranslations("feed");

  return (
    <AppShell
      current="home"
      viewerName={viewer.name}
      sidebar={<ProfileSummary />}
      asideLabel={t("asideLabel")}
      aside={
        <>
          <SuggestedConnections />
          <Trending />
          <JobRecommendations />
        </>
      }
    >
      <h1 className="sr-only">{t("title")}</h1>
      <PostComposer />
      <FeedItems />
    </AppShell>
  );
}
