import type { Metadata } from "next";
import { Heebo, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
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
      <body className={`${heebo.variable} ${bebasNeue.variable} font-sans antialiased overflow-x-hidden`}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
