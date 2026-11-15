import { Suspense } from "react";
import type { Metadata } from "next";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { BRANCH_SEO, branchMetadata } from "../../content/seo";
import { HAIFA_LANDING } from "../../content/landing-haifa";
import {
  Navbar,
  Hero,
  About,
  Services,
  BranchServices,
  Programs,
  Staff,
  Testimonials,
  FAQ,
  Contact,
  Footer,
} from "@/components/landing";
import { PaymentStatusHandler } from "@/components/payments/PaymentStatusHandler";
import { MotionProvider } from "@/components/MotionProvider";
import { loadLandingCatalog } from "@/features/enrollment/lib/catalog";

export const metadata: Metadata = branchMetadata(BRANCH_SEO.haifa);

/**
 * The prices come from the database, so the page cannot be frozen at build
 * time. Editing a product through /admin revalidates this path at once; the
 * hourly window covers a price changed straight in the database.
 */
export const revalidate = 3600;

/**
 * The Haifa landing page. Its price cards come from plan_products and every
 * "הצטרפו" leads to /join, as on the קריית אתא page. While Haifa has nothing
 * on sale (or the catalog cannot be read) the poster's WhatsApp cards stand in.
 */
export default async function HomePage() {
  const products = await loadLandingCatalog("haifa");
  const { branchName, services, location } = HAIFA_LANDING;

  return (
    <MotionProvider>
      <main id="main-content" tabIndex={-1} className="outline-none bg-paper">
        <LocalBusinessJsonLd
          seo={BRANCH_SEO.haifa}
          offers={products.map((p) => ({ name: p.name_he, price: p.price_ils, description: p.blurb_he }))}
        />
        <Navbar
          otherBranch={{ label: "סניף קריית אתא", href: "/kiryat-ata" }}
          ctaHref="#services"
          ctaLabel="הצטרפו עכשיו"
        />
        <Hero ctaHref="#services" />
        <About />
        {products.length > 0 ? (
          <BranchServices
            branch="haifa"
            products={products}
            copy={{
              branchName,
              intro: services.subtitle,
              highlightedSlug: services.highlightedSlug,
              address: location.address,
              whatsapp: location.whatsapp,
              phoneDisplay: location.phoneDisplay,
              notes: services.notes,
            }}
          />
        ) : (
          <Services />
        )}
        <Programs />
        <Staff />
        <Testimonials />
        <FAQ />
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
