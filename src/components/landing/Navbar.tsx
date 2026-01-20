"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "בית", href: "#" },
  { label: "אודות", href: "#about" },
  { label: "תוכניות", href: "#services" },
  { label: "צור קשר", href: "#contact" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("#");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll - background blur & active section
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Find active section
      const sections = navLinks.map((link) => link.href.replace("#", "")).filter(Boolean);

      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(`#${section}`);
            return;
          }
        }
      }
      setActiveSection("#");
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll handler
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.getElementById(href.replace("#", ""));
    if (element) {
      const offset = 80; // navbar height
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 ${
          isScrolled
            ? "bg-black/80 backdrop-blur-lg"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 z-50">
            <Image
              src="/logo-transparent.png"
              alt="Garden of Eden"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <span className="text-white font-medium text-sm">Garden of Eden</span>
          </Link>

          {/* Desktop Nav links */}
          <div className="hidden md:flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full px-2 py-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeSection === link.href
                    ? "bg-[#CDEA68] text-black"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Button
              size="sm"
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-0 rounded-full px-4"
              asChild
            >
              <a href="https://wa.me/972525779446" target="_blank" rel="noopener noreferrer">
                התחילו עכשיו
              </a>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white z-50"
            aria-label="תפריט"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-lg md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-6">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`text-2xl font-medium transition-colors ${
                    activeSection === link.href
                      ? "text-[#CDEA68]"
                      : "text-white/80"
                  }`}
                >
                  {link.label}
                </motion.a>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navLinks.length * 0.1 }}
                className="mt-4"
              >
                <Button
                  className="bg-[#CDEA68] hover:bg-[#bdd85c] text-black rounded-full px-8 py-6 text-lg font-medium"
                  asChild
                >
                  <a href="https://wa.me/972525779446" target="_blank" rel="noopener noreferrer">
                    התחילו עכשיו
                  </a>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
