import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

type NotFoundMessageProps = {
  title: string;
  description: string;
  home: string;
  /** Locale-prefixed home URL, e.g. "/tr". */
  homeHref: string;
  /** Set when the block's language differs from the page's (<html lang>). */
  lang?: string;
  heading?: "h1" | "h2";
};

// One language's 404 copy: heading, explanation and a link home. Shared by the
// localized 404 ([locale]/not-found.tsx) and the bilingual one (not-found.tsx).
export function NotFoundMessage({
  title,
  description,
  home,
  homeHref,
  lang,
  heading: Heading = "h1",
}: NotFoundMessageProps) {
  return (
    <section lang={lang} className="space-y-6">
      <div className="space-y-2">
        <Heading className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </Heading>
        <p className="text-fg-muted">{description}</p>
      </div>
      <Link href={homeHref} className={buttonClasses({ variant: "secondary", size: "lg" })}>
        {home}
      </Link>
    </section>
  );
}
