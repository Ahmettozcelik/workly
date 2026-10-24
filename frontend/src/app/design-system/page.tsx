import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

// Developer-only preview of the design system. Returns 404 in production.
const isProduction = process.env.NODE_ENV === "production";

export function generateMetadata(): Metadata {
  if (isProduction) notFound();
  return {
    title: "Design system · Workly",
    robots: { index: false, follow: false },
  };
}

const COLOR_TOKENS = [
  { name: "canvas", swatch: "bg-canvas" },
  { name: "surface", swatch: "bg-surface" },
  { name: "surface-raised", swatch: "bg-surface-raised" },
  { name: "fg", swatch: "bg-fg" },
  { name: "fg-muted", swatch: "bg-fg-muted" },
  { name: "line", swatch: "bg-line" },
  { name: "line-strong", swatch: "bg-line-strong" },
  { name: "primary", swatch: "bg-primary" },
  { name: "primary-fg", swatch: "bg-primary-fg" },
  { name: "accent", swatch: "bg-accent" },
  { name: "accent-text", swatch: "bg-accent-text" },
  { name: "focus", swatch: "bg-focus" },
  { name: "danger", swatch: "bg-danger" },
  { name: "success", swatch: "bg-success" },
];

export default function DesignSystemPage() {
  if (isProduction) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mt-10 space-y-14">
        <div className="space-y-3">
          <h1 className="font-display text-display font-bold">Design system</h1>
          <p className="max-w-2xl text-fg-muted">
            Developer-only preview of Workly tokens and components. Not
            available in production builds.
          </p>
        </div>

        <Section title="Colour tokens">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {COLOR_TOKENS.map((token) => (
              <li key={token.name} className="space-y-2">
                <div
                  className={`h-14 rounded-control border border-line ${token.swatch}`}
                />
                <code className="block text-sm">{token.name}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography">
          <div className="space-y-4">
            <p className="font-display text-display font-bold">
              İstanbul&apos;da ığdır şçöü
            </p>
            <p className="font-display text-3xl font-bold">
              Heading — Bricolage Grotesque
            </p>
            <p className="text-lg">
              Body — Inter: Çağrı, Şule, Ilgın, İlker — ĞÜŞİÖÇ ğüşıöç
            </p>
            <p className="text-fg-muted">Muted text (fg-muted)</p>
            <p className="text-accent-text">Accent text (accent-text)</p>
            <p className="text-danger">Danger text (danger)</p>
            <p className="text-success">Success text (success)</p>
          </div>
        </Section>

        <Section title="Button">
          <Subsection title="Variants (md)">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </Subsection>
          <Subsection title="Size lg">
            <Button size="lg">Primary</Button>
            <Button size="lg" variant="secondary">
              Secondary
            </Button>
            <Button size="lg" variant="ghost">
              Ghost
            </Button>
          </Subsection>
          <Subsection title="Disabled">
            <Button disabled>Primary</Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
          </Subsection>
          <Subsection title="Loading">
            <Button loading>Saving</Button>
            <Button variant="secondary" loading>
              Saving
            </Button>
            <Button variant="ghost" loading>
              Saving
            </Button>
          </Subsection>
          <Subsection title="Long Turkish label (wraps)">
            <div className="w-56">
              <Button variant="secondary">
                İş deneyimini daha sonra profiline ekleyebilirsin
              </Button>
            </div>
          </Subsection>
          <Subsection title="Full width">
            <Button size="lg" fullWidth>
              Full width primary
            </Button>
          </Subsection>
          <Subsection title="Link styled as button">
            <Link href="#button" className={buttonClasses({ variant: "secondary" })}>
              Link (secondary)
            </Link>
          </Subsection>
        </Section>

        <Section title="Card">
          <div className="grid gap-4 md:grid-cols-3">
            <Card padding="sm">
              <p className="font-semibold">padding=&quot;sm&quot;</p>
              <p className="text-fg-muted">Compact content.</p>
            </Card>
            <Card>
              <p className="font-semibold">padding=&quot;md&quot; (default)</p>
              <p className="text-fg-muted">Standard content.</p>
            </Card>
            <Card padding="lg">
              <p className="font-semibold">padding=&quot;lg&quot;</p>
              <p className="text-fg-muted">Roomier on larger screens.</p>
            </Card>
          </div>
        </Section>

        <Section title="Logo">
          <div className="flex flex-wrap items-end gap-8">
            <Logo />
            <Logo size="lg" />
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-6">
      <h2
        id={`${id}-heading`}
        className="border-b border-line pb-3 font-display text-2xl font-bold"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-fg-muted">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
