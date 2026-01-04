import { Navbar, Hero, About, Services, Programs, Contact, Footer } from "@/components/landing";

export default function HomePage() {
  return (
    <main className="bg-[#F5F5F0]">
      <Navbar />
      <Hero />
      <About />
      <Services />
      <Programs />
      <Contact />
      <Footer />
    </main>
  );
}
