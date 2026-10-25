import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app/app-shell";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { ApiUser } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/auth/server";
import { FeedItems } from "./feed-items";
import { PostComposer } from "./post-composer";
import { ProfileSummary } from "./profile-summary";
import { JobRecommendations, Trending } from "./side-panels";
import { SuggestedConnections } from "./suggested-connections";
import { VerifyEmailBanner } from "./verify-email-banner";

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

// Members only. The session is checked on the server for every request (so
// this page is dynamic): no valid session → the login page in the same
// language. If the backend cannot answer, getCurrentUser throws and error.tsx
// is shown instead of a misleading sign-in prompt.
// The feed content itself is still sample data (sample-data.ts).
export default async function FeedPage({ params }: PageProps<"/[locale]/feed">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });

  return <Feed user={user} />;
}

function Feed({ user }: { user: ApiUser }) {
  const t = useTranslations("feed");

  return (
    <AppShell
      current="home"
      viewerName={user.displayName}
      sidebar={<ProfileSummary user={user} />}
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
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      <PostComposer viewerName={user.displayName} />
      <FeedItems />
    </AppShell>
  );
}
