"use client";

import { motion } from "framer-motion";
import { MessageCircle, Phone, MapPin, Clock } from "lucide-react";

export function Contact() {
  return (
    <section id="contact" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] overflow-hidden relative">
              {/* Placeholder for contact image */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#CDEA68]/10 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-[#CDEA68]/40" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm text-black/50 mb-2 block">צור קשר</span>
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              יש לכם שאלה?
            </h2>
            <p className="text-black/60 mb-8">
              Garden of Eden מציע שירותים מותאמים אישית. צרו איתנו קשר ונחזור אליכם בהקדם!
            </p>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href="https://wa.me/972525779446"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10 hover:border-[#CDEA68]/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#CDEA68]/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#CDEA68]" />
                </div>
                <div>
                  <span className="text-black/50 text-xs block">וואטסאפ</span>
                  <span className="text-black font-medium text-sm">שלחו הודעה</span>
                </div>
              </a>

              <a
                href="tel:+972525779446"
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10 hover:border-[#CDEA68]/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#CDEA68]/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-[#CDEA68]" />
                </div>
                <div>
                  <span className="text-black/50 text-xs block">טלפון</span>
                  <span className="text-black font-medium text-sm">052-577-9446</span>
                </div>
              </a>

              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10">
                <div className="w-10 h-10 rounded-xl bg-[#CDEA68]/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#CDEA68]" />
                </div>
                <div>
                  <span className="text-black/50 text-xs block">שעות פעילות</span>
                  <span className="text-black font-medium text-sm">א׳-ה׳ 08:00-21:00</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10">
                <div className="w-10 h-10 rounded-xl bg-[#CDEA68]/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-[#CDEA68]" />
                </div>
                <div>
                  <span className="text-black/50 text-xs block">מיקום</span>
                  <span className="text-black font-medium text-sm">חיפה, ישראל</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
