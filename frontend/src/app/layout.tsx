import type { Metadata } from "next";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeSync } from "@/components/theme/theme-sync";
import { bricolage, inter } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workly",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: ThemeScript sets data-theme before hydration.
    <html
      lang="tr"
      className={`${inter.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
