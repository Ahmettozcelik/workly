import type { Metadata } from "next";
import { bricolage, inter } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workly",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
