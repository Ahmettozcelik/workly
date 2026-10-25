import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/server";
import { VerifyEmailForm } from "./verify-email-form";

// Opened from the verification mail: /{locale}/verify-email?token=…
// Not indexed (a personal, one-time link), so no canonical or hreflang.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail.meta" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

// Opening the page verifies nothing: mail link scanners open links too. The
// member confirms with a button (POST /api/auth/verify-email). The session
// only decides where to go next (feed or sign-in); the link works without one.
export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { token } = await searchParams;
  const signedIn = Boolean(await getCurrentUser().catch(() => null));

  return (
    <AuthShell>
      <VerifyEmailForm token={typeof token === "string" ? token : ""} signedIn={signedIn} />
    </AuthShell>
  );
}
