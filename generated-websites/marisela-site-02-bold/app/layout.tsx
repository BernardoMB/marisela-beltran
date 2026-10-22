import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import { artistContent } from "@/lib/content";
import { t } from "@/lib/i18n";
import "./globals.css";

const displayFont = Anton({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400","500","700","800"],
  style: ["normal"],
  variable: "--font-body",
  display: "swap",
});

const hero = artistContent.images.hero;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: `${artistContent.name} — ${artistContent.tagline}`,
  description: artistContent.shortBio,
  openGraph: {
    title: artistContent.name,
    description: artistContent.shortBio,
    locale: artistContent.locale.replace("-", "_"),
    type: "website",
    images: hero && !hero.placeholder ? [{ url: hero.src, width: hero.width, height: hero.height, alt: hero.alt }] : [],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1c080d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={artistContent.lang} className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
        >
          {t("skipToContent")}
        </a>
        {children}
      </body>
    </html>
  );
}
