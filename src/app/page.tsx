import { Suspense } from "react";
import type { Metadata } from "next";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { BRANCH_SEO, branchMetadata } from "../../content/seo";

export const metadata: Metadata = branchMetadata(BRANCH_SEO.haifa);
import { Navbar, Hero, About, Services, Programs, Staff, Testimonials, FAQ, Contact, Footer } from "@/components/landing";
import { PaymentStatusHandler } from "@/components/payments/PaymentStatusHandler";
import { MotionProvider } from "@/components/MotionProvider";

export default function HomePage() {
  return (
    <MotionProvider>
      <main id="main-content" tabIndex={-1} className="outline-none bg-paper">
        <LocalBusinessJsonLd seo={BRANCH_SEO.haifa} />
        <Navbar otherBranch={{ label: "סניף קריית אתא", href: "/kiryat-ata" }} />
        <Hero />
        <About />
        <Services />
        <Programs />
        <Staff />
        <Testimonials />
        <FAQ overrides={{ "faq-14": "הצוות משבץ את האימונים בלוח היומי ושולח את השיבוץ בוואטסאפ. אפשר לתאם ישירות עם המאמן." }} />
        <Contact />
        <Footer />

        {/* Payment Status Handler (shows toast for payment success/cancelled) */}
        <Suspense fallback={null}>
          <PaymentStatusHandler />
        </Suspense>
      </main>
    </MotionProvider>
  );
}
