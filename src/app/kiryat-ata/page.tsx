import type { Metadata } from "next";
import {
  Navbar,
  Hero,
  About,
  KiryatAtaServices,
  Staff,
  Testimonials,
  FAQ,
  Contact,
  Footer,
} from "@/components/landing";
import { MotionProvider } from "@/components/MotionProvider";
import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";
import { KIRYAT_ATA_LANDING } from "../../../content/landing-kiryat-ata";

export const metadata: Metadata = {
  title: "Garden of Eden - אקדמיית כדורגל בקריית אתא | הרשמה ותשלום באתר",
  description:
    "אימוני כדורגל מקצועיים בקריית אתא בקבוצות קטנות, עם ליווי מנטלי ותזונתי. בוחרים מסלול, נרשמים ומשלמים באתר.",
  keywords: ["אקדמיית כדורגל", "כדורגל קריית אתא", "אימוני כדורגל לילדים", "garden of eden", "קריית אתא"],
  alternates: { canonical: "/kiryat-ata" },
};

/**
 * The קריית אתא landing page: the Haifa page's sections with branch copy,
 * prices from plan_products, and every "הצטרפו" leading to /join.
 */
export default async function KiryatAtaPage() {
  const products = await loadKiryatAtaCatalog();
  const { hero, location, faqOverrides, faqOmit } = KIRYAT_ATA_LANDING;

  return (
    <MotionProvider>
      <main className="bg-[#F5F5F0]">
        <Navbar otherBranch={{ label: "סניף חיפה", href: "/" }} />
        <Hero
          eyebrow={hero.eyebrow}
          titleStart={hero.titleStart}
          titleAccent={hero.titleAccent}
          titleEnd={hero.titleEnd}
          subtitle={hero.subtitle}
          ctaLabel={hero.ctaLabel}
          ctaHref={hero.ctaHref}
        />
        <About />
        <KiryatAtaServices products={products} />
        <Staff />
        <Testimonials />
        <FAQ overrides={faqOverrides} omit={faqOmit} />
        <Contact
          location={{
            address: location.address,
            mapEmbedUrl: location.mapEmbedUrl,
            hours: location.hours,
            whatsapp: location.whatsapp,
            phoneDisplay: location.phoneDisplay,
            transport: [],
            moovitUrl: null,
          }}
        />
        <Footer />
      </main>
    </MotionProvider>
  );
}
