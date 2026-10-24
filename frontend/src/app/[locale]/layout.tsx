import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeSync } from "@/components/theme/theme-sync";
import { routing } from "@/i18n/routing";
import { bricolage, inter } from "@/lib/fonts";
import "../globals.css";

// Prerender every page once per locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    // Pages set only their own title, e.g. "Kayıt ol" -> "Kayıt ol · Workly".
    title: { default: t("appTitle"), template: "%s · Workly" },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Keeps the pages static (no request headers needed to read the locale).
  setRequestLocale(locale);

  return (
    // suppressHydrationWarning: ThemeScript sets data-theme before hydration.
    <html
      lang={locale}
      className={`${inter.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeSync />
        {/* Gives client components (form, theme toggle) the locale and messages. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
