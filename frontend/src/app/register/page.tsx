import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { registrationCopy as copy } from "./copy";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: copy.metaTitle,
};

export default function RegisterPage() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />

      <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo />
            <Badge>{copy.prototypeBadge}</Badge>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-start py-8 sm:justify-center lg:py-12">
          <div className="w-full max-w-md space-y-6">
            <p className="text-sm font-medium text-fg-muted lg:hidden">
              {copy.brand.points[0]}
            </p>
            <Card padding="lg">
              <RegistrationForm />
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// Always dark (Midnight) in both themes. Semantic text tokens are re-pointed
// locally so existing components (Logo, Badge) render in light-on-dark.
function BrandPanel() {
  return (
    <aside
      aria-label="Workly"
      className="relative m-3 hidden overflow-hidden rounded-card border border-line bg-(--wk-midnight) p-10 text-fg [--fg-muted:#9ca3af] [--fg:var(--wk-offwhite)] [--line-strong:#64708c] lg:flex lg:flex-col xl:p-14"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-(--wk-purple) opacity-25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -start-20 size-72 rounded-full bg-(--wk-lime) opacity-15 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <Logo />
        <Badge>{copy.prototypeBadge}</Badge>
      </div>

      <div className="relative mt-auto space-y-10 pt-16">
        <p className="max-w-md font-display text-display font-bold">
          {copy.brand.headline}
        </p>
        <ul className="space-y-5">
          {copy.brand.points.map((point) => (
            <li key={point} className="flex gap-3 text-lg">
              <CheckIcon />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
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
