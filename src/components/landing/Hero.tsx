"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export function Hero() {
  const scrollToAbout = () => {
    const element = document.getElementById("about");
    if (element) {
      const offset = 80;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section className="relative">
      {/* Hero content */}
      <div className="relative h-screen min-h-[600px] max-h-[900px]">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[#1a1a1a]">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/landing/hero-balance.webp')" }}
          />
          {/* Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/50" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-end pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
              גלה את הפוטנציאל שלך
              <br />
              <span className="text-white">ב</span>
              <span className="text-[#CDEA68]">מרכז האימונים</span> שלנו
            </h1>

            <p className="text-white/70 text-lg mb-8 max-w-md">
              הצטרפו לקהילה שלנו היום וגלו את הפוטנציאל המלא שלכם עם מאמנים מומחים, ציוד מתקדם ותוכניות מנוי גמישות
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <Button
                className="bg-[#CDEA68] hover:bg-[#bdd85c] text-black font-medium rounded-full px-6 py-5"
                asChild
              >
                <a href="https://wa.me/972525779446" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 ml-2" />
                  הצטרפו עכשיו
                </a>
              </Button>

              <Button
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 rounded-full px-6 py-5"
                onClick={scrollToAbout}
              >
                למידע נוסף
              </Button>
            </div>
          </motion.div>

          {/* Scroll indicator - clickable */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={scrollToAbout}
            className="absolute bottom-8 left-6 cursor-pointer group"
            aria-label="גלול למטה"
          >
            <div className="w-8 h-14 border-2 border-white/30 group-hover:border-[#CDEA68]/50 rounded-full flex justify-center pt-2 transition-colors">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-3 bg-[#CDEA68] rounded-full"
              />
            </div>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
