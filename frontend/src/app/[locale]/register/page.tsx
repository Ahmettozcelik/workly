import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { localeAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { redirectSignedInToFeed } from "@/lib/auth/server";
import { RegistrationForm } from "./registration-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth.register.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/register"),
  };
}

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Reads the session cookie, so this page is rendered per request.
  await redirectSignedInToFeed(locale);

  return (
    <AuthShell>
      <RegistrationForm />
    </AuthShell>
  );
}
