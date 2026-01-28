import { Suspense } from "react";
import { Navbar, Hero, About, Services, Programs, Testimonials, FAQ, Contact, Footer } from "@/components/landing";
import { PaymentStatusHandler } from "@/components/payments/PaymentStatusHandler";

export default function HomePage() {
  return (
    <main className="bg-[#F5F5F0]">
      <Navbar />
      <Hero />
      <About />
      <Services />
      <Programs />
      <Testimonials />
      <FAQ />
      <Contact />
      <Footer />

      {/* Payment Status Handler (shows toast for payment success/cancelled) */}
      <Suspense fallback={null}>
        <PaymentStatusHandler />
      </Suspense>
    </main>
  );
}
