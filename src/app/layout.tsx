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
  title: "Garden of Eden - אימוני כדורגל מקצועיים",
  description: "מרכז אימוני כדורגל מקצועי לשחקנים צעירים. פיתוח יכולות אתלטיות, מנטליות וטקטיות.",
  keywords: ["כדורגל", "אימונים", "שחקנים צעירים", "פיתוח אתלטי", "garden of eden"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${bebasNeue.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
