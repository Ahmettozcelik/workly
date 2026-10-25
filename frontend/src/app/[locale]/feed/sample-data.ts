// PROTOTYPE: sample content for the feed until the backend exists. Names are
// shared; text is per locale. Times are relative to a fixed NOW so the server
// and the browser render the same "2 hours ago" and tests stay stable.
import type { Locale } from "next-intl";

export type Localized = Record<Locale, string>;

export const pick = (text: Localized, locale: Locale) => text[locale];

export const NOW = new Date("2026-10-25T09:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

export type WorkMode = "remote" | "hybrid" | "onsite";

export const viewer = {
  name: "Ayşe Yılmaz",
  title: { tr: "Ürün Tasarımcısı", en: "Product Designer" } as Localized,
  workEmailVerified: true,
  connections: 248,
  profileViews: 37,
  profileCompletion: 60,
  nextStep: { tr: "Deneyim ekle", en: "Add your experience" } as Localized,
};

export type Person = { name: string; title: Localized };

export type FeedItem =
  | {
      kind: "post";
      id: string;
      author: Person;
      fromConnection: boolean;
      createdAt: Date;
      body: Localized;
      likes: number;
      comments: number;
    }
  | {
      kind: "job";
      id: string;
      company: string;
      role: Localized;
      location: Localized;
      workMode: WorkMode;
      createdAt: Date;
    };

export const feedItems: FeedItem[] = [
  {
    kind: "post",
    id: "p1",
    author: { name: "Can Şahin", title: { tr: "Kıdemli Backend Geliştirici", en: "Senior Backend Developer" } },
    fromConnection: true,
    createdAt: minutesAgo(120),
    body: {
      tr: "Ekibimizle ödeme servisini Java 21 sanal thread'lerine taşıdık. Aynı donanımda iki kat istek karşılıyoruz. Deneyimlerimizi önümüzdeki hafta bir yazıyla paylaşacağım.",
      en: "Our team moved the payments service to Java 21 virtual threads. We now handle twice the requests on the same hardware. I'll share what we learned in a write-up next week.",
    },
    likes: 42,
    comments: 7,
  },
  {
    kind: "job",
    id: "j1",
    company: "Nova Finans",
    role: { tr: "Frontend Geliştirici (React)", en: "Frontend Developer (React)" },
    location: { tr: "İstanbul", en: "Istanbul" },
    workMode: "hybrid",
    createdAt: minutesAgo(300),
  },
  {
    kind: "post",
    id: "p2",
    author: { name: "Elif Demir", title: { tr: "İnsan Kaynakları Yöneticisi", en: "HR Manager" } },
    fromConnection: false,
    createdAt: minutesAgo(60 * 9),
    body: {
      tr: "Yeni mezunlara tavsiyem: Özgeçmişinize yalnızca görevleri değil, sonuçları da yazın. \"Raporları hazırladım\" yerine \"Raporlama süresini %30 kısalttım\" çok daha güçlü.",
      en: "My advice to new graduates: list results, not just tasks, on your CV. \"Cut reporting time by 30%\" is much stronger than \"Prepared reports\".",
    },
    likes: 128,
    comments: 23,
  },
  {
    kind: "post",
    id: "p3",
    author: { name: "Burak Aydın", title: { tr: "Veri Bilimci", en: "Data Scientist" } },
    fromConnection: true,
    createdAt: minutesAgo(60 * 26),
    body: {
      tr: "Bu hafta bir sınıflandırma modelinde açıklanabilirlik üzerine çalıştık. Paydaşlara sadece doğruluğu değil, kararın nedenini de gösterebilmek güveni gerçekten artırıyor.",
      en: "This week we worked on explainability for a classification model. Showing stakeholders why a decision was made, not just how accurate it is, really builds trust.",
    },
    likes: 31,
    comments: 4,
  },
];

export const suggestions: (Person & { id: string; mutual: number })[] = [
  { id: "s1", name: "Mert Kaya", title: { tr: "DevOps Mühendisi", en: "DevOps Engineer" }, mutual: 12 },
  { id: "s2", name: "Zeynep Öztürk", title: { tr: "Ürün Yöneticisi", en: "Product Manager" }, mutual: 8 },
  { id: "s3", name: "İlker Çelik", title: { tr: "Mobil Geliştirici", en: "Mobile Developer" }, mutual: 5 },
];

export const trending: { id: string; tag: Localized; posts: number }[] = [
  { id: "t1", tag: { tr: "#UzaktanÇalışma", en: "#RemoteWork" }, posts: 1240 },
  { id: "t2", tag: { tr: "#YapayZekâ", en: "#AI" }, posts: 980 },
  { id: "t3", tag: { tr: "#KariyerDeğişimi", en: "#CareerChange" }, posts: 615 },
  { id: "t4", tag: { tr: "#İşeAlım", en: "#Hiring" }, posts: 402 },
  { id: "t5", tag: { tr: "#YeniMezun", en: "#NewGrad" }, posts: 287 },
];

export const recommendedJobs: { id: string; company: string; role: Localized; location: Localized; workMode: WorkMode; createdAt: Date }[] = [
  {
    id: "r1",
    company: "Atlas Lojistik",
    role: { tr: "UX Araştırmacısı", en: "UX Researcher" },
    location: { tr: "Ankara", en: "Ankara" },
    workMode: "onsite",
    createdAt: minutesAgo(60 * 20),
  },
  {
    id: "r2",
    company: "Pixel Oyun",
    role: { tr: "Ürün Tasarımcısı", en: "Product Designer" },
    location: { tr: "Türkiye", en: "Türkiye" },
    workMode: "remote",
    createdAt: minutesAgo(60 * 48),
  },
  {
    id: "r3",
    company: "Ege Sağlık",
    role: { tr: "Tasarım Sistemi Uzmanı", en: "Design Systems Specialist" },
    location: { tr: "İzmir", en: "Izmir" },
    workMode: "hybrid",
    createdAt: minutesAgo(60 * 72),
  },
];
