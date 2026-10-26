import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app/app-shell";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/server";
import { ProfileSummary } from "../../feed/profile-summary";
import { SecuritySettings } from "./security-settings";

// A signed-in member's page: not indexed, so no canonical or hreflang.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/security">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "settingsSecurity.meta" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

// Members only, checked on the server for every request (like the feed): no
// valid session → the login page in the same language.
export default async function SecuritySettingsPage({ params }: PageProps<"/[locale]/settings/security">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations({ locale, namespace: "settingsSecurity" });

  return (
    <AppShell viewerName={user.displayName} sidebar={<ProfileSummary user={user} />}>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-fg-muted">{t("subtitle")}</p>
      </div>
      <SecuritySettings />
    </AppShell>
  );
}
