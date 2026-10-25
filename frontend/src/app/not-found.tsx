import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotFoundMessage } from "@/components/not-found/not-found-message";
import { ThemeScript } from "@/components/theme/theme-script";
import { Logo } from "@/components/ui/logo";
import { routing } from "@/i18n/routing";
import { bricolage, inter } from "@/lib/fonts";
import "./globals.css";

// The 404 for every unmatched URL, including unknown paths under /tr and /en.
// It is prerendered once, and reading the request's locale would make every
// route dynamic, so it shows both languages (Turkish first, English marked
// with lang="en"). The root layout passes children through, so this renders
// the whole document. Next.js adds robots noindex to 404 responses.

const notFoundCopy = () =>
  Promise.all(
    routing.locales.map(async (locale) => ({
      locale,
      t: await getTranslations({ locale, namespace: "notFound" }),
    })),
  );

export async function generateMetadata(): Promise<Metadata> {
  const copies = await notFoundCopy();
  return { title: copies.map(({ t }) => t("title")).join(" · ") };
}

export default async function RootNotFound() {
  const copies = await notFoundCopy();
  const lang = routing.defaultLocale;

  return (
    // suppressHydrationWarning: ThemeScript sets data-theme before hydration.
    <html
      lang={lang}
      className={`${inter.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
          <div className="w-full max-w-md space-y-8 text-center">
            <Logo />
            {copies.map(({ locale, t }, index) => (
              <div key={locale} className={index > 0 ? "border-t border-line pt-8" : undefined}>
                <NotFoundMessage
                  title={t("title")}
                  description={t("description")}
                  home={t("home")}
                  homeHref={`/${locale}`}
                  lang={locale === lang ? undefined : locale}
                  heading={index === 0 ? "h1" : "h2"}
                />
              </div>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}
