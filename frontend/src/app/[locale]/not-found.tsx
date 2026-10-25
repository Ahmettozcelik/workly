import { useLocale, useTranslations } from "next-intl";
import { NotFoundMessage } from "@/components/not-found/not-found-message";
import { Logo } from "@/components/ui/logo";

// Localized 404 for notFound() called inside a locale page (e.g. the design
// system in production). Next.js 16 sends such responses as an error shell and
// renders this on the client; unmatched URLs instead get the server-rendered
// bilingual app/not-found.tsx.
export default function LocaleNotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <Logo />
        <NotFoundMessage
          title={t("title")}
          description={t("description")}
          home={t("home")}
          homeHref={`/${locale}`}
        />
      </div>
    </main>
  );
}
