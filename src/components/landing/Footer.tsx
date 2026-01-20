"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MessageCircle, Instagram, ArrowUp, Phone, MapPin } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useState, useEffect } from "react";

const quickLinks = [
  { href: "#", label: "בית" },
  { href: "#about", label: "אודות" },
  { href: "#services", label: "מחירון" },
  { href: "#programs", label: "תוכניות" },
  { href: "#contact", label: "צור קשר" },
];

const serviceLinks = [
  { href: "/auth/login", label: "התחברות" },
  { href: "/dashboard", label: "איזור אישי" },
  { href: "/dashboard/videos", label: "סרטונים" },
];

const socialLinks = [
  {
    href: "https://wa.me/972525779446",
    label: "וואטסאפ",
    icon: MessageCircle,
    external: true,
  },
  {
    href: "https://www.instagram.com/garden_of_eden_soccer_academy/",
    label: "Instagram",
    icon: Instagram,
    external: true,
  },
  {
    href: "https://www.tiktok.com/@edenbenhemo1",
    label: "TikTok",
    icon: SiTiktok,
    external: true,
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Show/hide back to top button based on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll handler
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();

      if (href === "#") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const element = document.getElementById(href.replace("#", ""));
      if (element) {
        const offset = 80;
        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <footer className="bg-[#1a1a1a] text-white relative">
        <div className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-12 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-4">
              <a
                href="#"
                onClick={(e) => handleNavClick(e, "#")}
                className="inline-flex items-center gap-2 mb-6 group"
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <Image
                    src="/logo-transparent.png"
                    alt="Garden of Eden"
                    width={24}
                    height={24}
                    className="w-6 h-6 object-contain"
                  />
                </motion.div>
                <span className="font-bold group-hover:text-[#CDEA68] transition-colors">
                  GARDEN OF EDEN
                </span>
              </a>
              <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
                יחד עם Garden of Eden תעבור טרנספורמציה אמיתית - פיזית, מנטלית וטקטית. מתעניינים? הצטרפו עכשיו!
              </p>

              {/* Contact info */}
              <div className="space-y-2">
                <a
                  href="tel:+972525779446"
                  className="flex items-center gap-2 text-white/50 hover:text-[#CDEA68] transition-colors text-sm group"
                >
                  <Phone className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  052-577-9446
                </a>
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <MapPin className="w-4 h-4" />
                  חיפה, ישראל
                </div>
              </div>
            </div>

            {/* Quick Access */}
            <div className="md:col-span-2">
              <h4 className="font-medium mb-6">גישה מהירה</h4>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="text-white/50 hover:text-[#CDEA68] transition-colors text-sm inline-block relative group"
                    >
                      {link.label}
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-[#CDEA68] group-hover:w-full transition-all duration-300" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div className="md:col-span-3">
              <h4 className="font-medium mb-6">שירותים</h4>
              <ul className="space-y-3">
                {serviceLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/50 hover:text-[#CDEA68] transition-colors text-sm inline-block relative group"
                    >
                      {link.label}
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-[#CDEA68] group-hover:w-full transition-all duration-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social & Contact */}
            <div className="md:col-span-3">
              <h4 className="font-medium mb-6">עקבו אחרינו</h4>

              {/* Social icons */}
              <div className="flex gap-3 mb-6">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-[#CDEA68] flex items-center justify-center text-white hover:text-black transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="w-5 h-5" />
                  </motion.a>
                ))}
              </div>

              {/* Social links list */}
              <ul className="space-y-3">
                {socialLinks.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white/50 hover:text-[#CDEA68] transition-colors text-sm group"
                    >
                      <social.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
            <p className="text-white/30 text-sm mb-4 md:mb-0">
              Copyright &copy; {currentYear} Garden of Eden. כל הזכויות שמורות.
            </p>
            <div className="flex gap-6">
              <Link
                href="/terms-of-service"
                className="text-white/30 hover:text-white/50 text-sm transition-colors"
              >
                תנאי שימוש
              </Link>
              <Link
                href="/privacy-policy"
                className="text-white/30 hover:text-white/50 text-sm transition-colors"
              >
                מדיניות פרטיות
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: showBackToTop ? 1 : 0,
          scale: showBackToTop ? 1 : 0.8,
          pointerEvents: showBackToTop ? "auto" : "none",
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={scrollToTop}
        className="fixed bottom-8 left-8 w-12 h-12 rounded-full bg-[#CDEA68] text-black shadow-lg flex items-center justify-center z-40"
        aria-label="חזרה למעלה"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    </>
  );
}
