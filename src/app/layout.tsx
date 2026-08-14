import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

/**
 * Fonts are self-hosted, not fetched from Google at build time.
 *
 * `next/font/google` downloads the woff2 from fonts.gstatic.com during the
 * build, and Vercel's build sandbox fails that request often enough that
 * roughly half of production deploys died with "Module not found: Can't
 * resolve '@vercel/turbopack-next/internal/font/google/font'". The files in
 * public/fonts are the exact same Google subsets, committed once.
 *
 * Latin and Hebrew are SEPARATE localFont calls rather than two `src` entries
 * on one call. Two faces sharing a family with identical weight and style and
 * no unicode-range are not a per-character fallback chain: the browser picks
 * one and sends glyphs it lacks to the next FAMILY, which on this Hebrew site
 * would silently render every Hebrew character in a system font. Splitting
 * them lets each carry the unicode-range Google itself ships, and the two
 * generated families are composed into --font-heebo below.
 */
/**
 * Heebo is a variable face, so one file covers the 300-900 range in use.
 * The unicode-range strings are Google's own, inlined as literals because
 * next/font parses these call arguments statically and rejects references.
 */
const heeboHebrew = localFont({
  src: [{ path: "../../public/fonts/heebo-hebrew.woff2", weight: "300 900" }],
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F",
    },
  ],
});

const heeboLatin = localFont({
  src: [{ path: "../../public/fonts/heebo-latin.woff2", weight: "300 900" }],
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const bebasNeue = localFont({
  variable: "--font-bebas",
  display: "swap",
  src: [{ path: "../../public/fonts/bebas-neue-latin.woff2", weight: "400" }],
});

/** Hebrew first: it is the primary script of every user-facing string here. */
const heeboFamily = `${heeboHebrew.style.fontFamily}, ${heeboLatin.style.fontFamily}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A1F0A",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "Garden of Eden - אקדמיית הכדורגל עם מעטפת מלאה | חיפה",
  description: "אקדמיית כדורגל מקצועית בחיפה עם מעטפת מלאה: אימוני כדורגל, אימוני אתלטיות, ליווי מנטלי, ליווי תזונה, אנליסט כדורגל וניהול קריירה.",
  keywords: ["אקדמיית כדורגל", "כדורגל חיפה", "אימוני אתלטיות", "ליווי מנטלי", "תזונת ספורטאים", "אנליסט כדורגל", "ניהול קריירה", "garden of eden", "שחקנים צעירים"],
  authors: [{ name: "Garden of Eden" }],
  creator: "Garden of Eden",
  metadataBase: new URL("https://www.edengarden.co.il"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "https://www.edengarden.co.il",
    siteName: "Garden of Eden",
    title: "Garden of Eden - אקדמיית הכדורגל עם מעטפת מלאה | חיפה",
    description: "אקדמיית כדורגל מקצועית בחיפה: אימוני כדורגל ואתלטיות, ליווי מנטלי ותזונה, אנליסט כדורגל וניהול קריירה.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Garden of Eden - אקדמיית כדורגל",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Garden of Eden - אקדמיית הכדורגל עם מעטפת מלאה",
    description: "אקדמיית כדורגל מקצועית בחיפה: אימוני כדורגל ואתלטיות, ליווי מנטלי ותזונה, אנליסט וניהול קריירה.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="overflow-x-hidden">
      {/* --font-heebo is set inline because it composes two generated
          families (Hebrew + Latin); Tailwind reads it via --font-sans. */}
      <body
        style={{ "--font-heebo": heeboFamily } as React.CSSProperties}
        className={`${bebasNeue.variable} font-sans antialiased overflow-x-hidden`}
      >
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
        <Toaster position="top-center" />
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
