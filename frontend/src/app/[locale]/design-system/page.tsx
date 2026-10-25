import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Developer-only preview of the design system. Returns 404 in production.
const isProduction = process.env.NODE_ENV === "production";

export function generateMetadata(): Metadata {
  if (isProduction) notFound();
  return {
    title: "Design system",
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

        <Section title="Input">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Default">
              {(control) => <Input placeholder="Placeholder text" {...control} />}
            </FormField>
            <FormField label="With hint" hint="Helper text sits between label and control.">
              {(control) => <Input type="email" autoComplete="off" {...control} />}
            </FormField>
            <FormField label="Required" required>
              {(control) => <Input {...control} />}
            </FormField>
            <FormField
              label="With error"
              hint="Use your personal email address."
              error="Enter a valid email address."
              required
            >
              {(control) => (
                <Input type="email" defaultValue="not-an-email" {...control} />
              )}
            </FormField>
            <FormField label="Disabled" disabled>
              {(control) => <Input defaultValue="Disabled value" {...control} />}
            </FormField>
            <FormField label="Read-only" hint="Focusable, not editable.">
              {(control) => <Input readOnly defaultValue="Read-only value" {...control} />}
            </FormField>
          </div>
        </Section>

        <Section title="Textarea">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Default (4 rows, vertical resize)">
              {(control) => <Textarea placeholder="Write something…" {...control} />}
            </FormField>
            <FormField label="With error" error="This field cannot be empty." required>
              {(control) => <Textarea {...control} />}
            </FormField>
          </div>
        </Section>

        <Section title="Select">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Default with placeholder option">
              {(control) => (
                <Select defaultValue="" {...control}>
                  <option value="" disabled>
                    Choose an option…
                  </option>
                  <option value="a">Option A</option>
                  <option value="b">Option B</option>
                </Select>
              )}
            </FormField>
            <FormField label="With error" error="Please choose an option." required>
              {(control) => (
                <Select defaultValue="" {...control}>
                  <option value="" disabled>
                    Choose an option…
                  </option>
                  <option value="a">Option A</option>
                </Select>
              )}
            </FormField>
            <FormField label="Disabled" disabled>
              {(control) => (
                <Select defaultValue="a" {...control}>
                  <option value="a">Option A</option>
                </Select>
              )}
            </FormField>
          </div>
        </Section>

        <Section title="Form field">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <FormField
                label="Extra description (describedBy)"
                hint="Hint, error and extra IDs are merged."
                describedBy="ds-notes-counter"
              >
                {(control) => <Textarea rows={3} {...control} />}
              </FormField>
              <p id="ds-notes-counter" className="text-sm text-fg-muted">
                0 / 500 characters
              </p>
            </div>
            <FormField
              label="Uzun Türkçe etiket: İş deneyimini daha sonra profiline ekleyebilirsin"
              hint="İpucu metni de uzun olabilir ve satır kaydırması yapmalıdır."
              error="Lütfen geçerli bir değer girin; bu hata mesajı da uzun olabilir."
              required
            >
              {(control) => <Input {...control} />}
            </FormField>
          </div>
        </Section>

        <Section title="Checkbox">
          <div className="grid gap-6 md:grid-cols-2">
            <Checkbox label="Default" />
            <Checkbox label="Checked" defaultChecked />
            <Checkbox
              label="With description"
              description="Descriptions sit below the label and are announced."
            />
            <Checkbox label="Required" required />
            <Checkbox
              label="With error"
              required
              error="This box must be checked to continue."
            />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="Disabled and checked" disabled defaultChecked />
            <Checkbox
              label="Uzun Türkçe etiket: Ürün güncellemeleri ve iş fırsatları hakkında e-posta almak istiyorum"
              description="İstediğin zaman ayarlardan değiştirebilirsin."
            />
          </div>
        </Section>

        <Section title="Badge">
          <Subsection title="On canvas">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">Verified Email</Badge>
            <Badge variant="danger">Danger</Badge>
          </Subsection>
          <Card padding="sm">
            <h3 className="mb-3 text-sm font-semibold text-fg-muted">On surface</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Neutral</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Verified Email</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </Card>
        </Section>

        <Section title="Avatar">
          <Subsection title="Sizes (sm 32 · md 40 · lg 56)">
            <Avatar name="İlker Çağlar" size="sm" />
            <Avatar name="İlker Çağlar" />
            <Avatar name="İlker Çağlar" size="lg" />
          </Subsection>
          <Subsection title="Turkish-aware initials">
            <Avatar name="ilker çağlar" />
            <Avatar name="ışıl şahin" />
            <Avatar name="Ömer" />
            <Avatar name="  Zeynep   Nur  Öztürk " />
            <Avatar name="" />
          </Subsection>
          <Subsection title="Decorative (name shown next to it)">
            <span className="inline-flex items-center gap-3">
              <Avatar name="Şule Yıldız" decorative />
              <span className="font-semibold">Şule Yıldız</span>
            </span>
          </Subsection>
        </Section>

        <Section title="Alert">
          <div className="grid gap-4 md:grid-cols-2">
            <Alert variant="danger" title="We couldn't save your changes">
              Please check the highlighted fields and try again.
            </Alert>
            <Alert variant="success" title="Check your inbox">
              We sent a verification link to your email address.
            </Alert>
            <Alert title="Heads up">Neutral information without urgency.</Alert>
            <Alert variant="danger">Message only, without a title.</Alert>
          </div>
        </Section>

        <Section title="Example form">
          <Card padding="lg" className="max-w-lg">
            {/* Preview only: the button does not submit. */}
            <form noValidate className="space-y-5">
              <Alert variant="danger" title="Submission failed">
                Form-level errors appear here, above the fields.
              </Alert>
              <p className="text-sm text-fg-muted">
                <span aria-hidden="true" className="text-danger">
                  *
                </span>{" "}
                Required field
              </p>
              <FormField label="Email" hint="Use your personal email address." required>
                {(control) => <Input type="email" autoComplete="off" {...control} />}
              </FormField>
              <FormField label="Topic">
                {(control) => (
                  <Select defaultValue="" {...control}>
                    <option value="" disabled>
                      Choose a topic…
                    </option>
                    <option value="general">General</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Message">
                {(control) => <Textarea {...control} />}
              </FormField>
              <Button size="lg" fullWidth>
                Continue
              </Button>
            </form>
          </Card>
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
