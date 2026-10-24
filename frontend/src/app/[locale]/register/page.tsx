import type { Metadata } from "next";
import { getImageProps, type StaticImageData } from "next/image";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { localeAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import darkPhoto from "./images/Workly-Dark.jpg";
import lightPhoto from "./images/Workly-Light.jpg";
import { RegistrationForm } from "./registration-form";

// Brand panel messages, in display order (auth.brand.points.*).
const BRAND_POINTS = ["oneAccount", "workEmail", "verify"] as const;

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

// Decorative office/city photographs for the desktop brand panel, one per
// theme (same composition: sunset for light, night for dark). Static imports
// give Next.js the dimensions and fail the build if a file is missing.

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Keeps the page static (no request headers needed to read the locale).
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(400px,25vw,440px)]">
      <BrandPanel />

      <div className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo />
            <Badge>{t("prototype.badge")}</Badge>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-start pt-8 pb-12 sm:justify-center sm:py-12">
          <div className="w-full max-w-md space-y-8">
            <p className="border-s-2 border-accent ps-3 text-sm font-medium text-fg-muted lg:hidden">
              {t("auth.brand.points.oneAccount")}
            </p>
            <RegistrationForm />
          </div>
        </main>
      </div>
    </div>
  );
}

// Always dark (Midnight) in both themes. The on-midnight utility re-points the
// semantic text tokens so existing components (Logo, Badge) render light-on-dark.
function BrandPanel() {
  const t = useTranslations();

  return (
    <aside
      aria-label="Workly"
      className="relative hidden overflow-hidden border-e border-line bg-(--wk-midnight) p-10 text-fg on-midnight lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col xl:p-14 2xl:p-16"
    >
      <OfficePhoto />

      <div className="relative flex items-center gap-3">
        <Logo />
        <Badge>{t("prototype.badge")}</Badge>
      </div>

      <div className="relative mt-auto space-y-10 pt-16">
        <p className="max-w-md font-display text-display font-bold">
          {t("auth.brand.headline")}
        </p>
        <ul className="max-w-md space-y-5">
          {BRAND_POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-lg">
              <CheckIcon />
              <span>{t(`auth.brand.points.${point}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// Optimised (next/image) URLs as a CSS image-set, per the Next.js docs.
function imageSet(photo: StaticImageData) {
  const {
    props: { srcSet = "" },
  } = getImageProps({ src: photo, alt: "", quality: 75 });
  const candidates = srcSet
    .split(", ")
    .map((entry) => {
      const [url, density] = entry.split(" ");
      return `url("${url}") ${density}`;
    })
    .join(", ");
  return `image-set(${candidates})`;
}

function OfficePhoto() {
  // The whole 1376x768 frame is shown, uncropped and undistorted: a box with
  // the photo's own aspect ratio spans the top of the panel and dissolves
  // into the Midnight panel below, where the headline and messages sit.
  // Theme-specific CSS backgrounds: browsers fetch only the visible one, and
  // nothing below lg (the panel is display:none there). data-theme is set
  // before first paint, so the right photo shows without a flash.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 aspect-[1376/768]">
        <div
          className="absolute inset-0 bg-cover bg-center contrast-[1.06] dark:hidden"
          style={{ backgroundImage: imageSet(lightPhoto) }}
        />
        <div
          className="absolute inset-0 hidden bg-cover bg-center contrast-[1.06] dark:block"
          style={{ backgroundImage: imageSet(darkPhoto) }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-(--wk-midnight)/0 from-55% to-(--wk-midnight) to-100%" />
      </div>
      {/* Text scrim limited to the copy column (fixed px, so wide panels keep
          the sunset sky and tower clear) and masked out above the headline. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--wk-midnight)_90%,transparent)_0px,color-mix(in_srgb,var(--wk-midnight)_78%,transparent)_440px,transparent_720px)] [mask-image:linear-gradient(to_bottom,transparent_16%,black_38%)]" />
      <div className="absolute inset-0 bg-radial-[at_0%_0%] from-(--wk-midnight)/95 from-0% via-(--wk-midnight)/88 via-22% to-(--wk-midnight)/0 to-38%" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-0.5 size-6 shrink-0 text-(--wk-lime)"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
