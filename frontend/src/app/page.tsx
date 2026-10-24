import { ThemeToggle } from "@/components/theme/theme-toggle";

// Temporary Step 2.1/2.2 check for tokens, Turkish glyphs and theme switching;
// replaced by the /design-system preview in Step 2.3.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <ThemeToggle />
      <h1 className="font-display text-display font-bold">
        İstanbul&apos;da ığdır şçöü
      </h1>
      <p className="text-lg">
        Inter gövde metni: Çağrı, Şule, Ilgın, İlker — ĞÜŞİÖÇ ğüşıöç
      </p>
      <p className="text-fg-muted">İkincil metin (fg-muted)</p>
      <p className="text-accent-text">Vurgu metni (accent-text)</p>
      <p className="text-danger">Hata metni (danger)</p>
      <p className="text-success">Başarı metni (success)</p>
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <p>Surface + line + shadow-card</p>
        <div className="mt-4 rounded-control border border-line-strong p-3">
          line-strong (input boundary)
        </div>
        <span className="mt-4 inline-block rounded-control bg-primary px-5 py-3 font-semibold text-primary-fg">
          Primary
        </span>
      </div>
    </main>
  );
}
