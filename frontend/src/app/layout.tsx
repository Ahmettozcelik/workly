import type { ReactNode } from "react";

// Pass-through root layout: <html> and <body> come from [locale]/layout.tsx,
// or from app/not-found.tsx for unmatched URLs. Without a root layout above
// [locale], Next.js would serve unmatched URLs a bare 404 (no lang or styles).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
