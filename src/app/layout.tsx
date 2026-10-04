import type { Metadata } from "next";
import { Newsreader, Noto_Sans_Devanagari, Noto_Serif_Devanagari, Plus_Jakarta_Sans, Reenie_Beanie } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Hindi reports and transcripts: the Latin fonts above have no Devanagari.
const devaSans = Noto_Sans_Devanagari({
  variable: "--font-deva-sans",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
});

const devaSerif = Noto_Serif_Devanagari({
  variable: "--font-deva-serif",
  subsets: ["devanagari"],
  weight: ["400", "500"],
});

const reenie = Reenie_Beanie({
  variable: "--font-reenie",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description:
    "Yaad listens to the doctor–patient conversation and writes a clear, doctor-approved visit report — so doctors can look at the patient, not the paper.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${jakarta.variable} ${devaSans.variable} ${devaSerif.variable} ${reenie.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
