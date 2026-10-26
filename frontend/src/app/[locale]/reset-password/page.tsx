import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { routing } from "@/i18n/routing";
import { ResetPasswordForm } from "./reset-password-form";

// Opened from the reset mail: /{locale}/reset-password?token=…
// Not indexed (a personal, one-time link), so no canonical or hreflang. The
// token is never sent on as a Referer (next.config.ts), and the form removes
// it from the address bar and history once read.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth.resetPassword.meta" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

// Works signed in or out: a reset ends every session of the member anyway.
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { token } = await searchParams;

  return (
    <AuthShell>
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
