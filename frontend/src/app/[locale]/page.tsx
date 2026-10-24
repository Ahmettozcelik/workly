import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    // The brand alone: "Workly", without the "%s · Workly" template.
    title: { absolute: t("appTitle") },
    description: t("appDescription"),
    alternates: localeAlternates(locale, "/"),
  };
}

export default function Home() {
  return <main>Workly</main>;
}
