import { Bricolage_Grotesque, Inter } from "next/font/google";

// latin-ext is required for Turkish (İ ı Ğ ğ Ş ş).
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
});
