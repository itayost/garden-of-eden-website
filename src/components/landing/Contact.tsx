"use client";

import { motion } from "framer-motion";
import { MessageCircle, Phone, MapPin, Clock } from "lucide-react";

export function Contact() {
  return (
    <section id="contact" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Google Maps */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="aspect-[4/3] rounded-3xl overflow-hidden relative bg-[#1a1a1a]">
              {/* Google Maps Embed - Haifa placeholder location */}
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d53814.41833089365!2d34.95!3d32.79!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151dba0b0f8d2d1f%3A0x3d1c5d0f0f7a2b0!2sHaifa%2C%20Israel!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="מפת המיקום שלנו בחיפה"
              />
              {/* Note overlay for placeholder */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <span className="text-white/70 text-sm">
                  דרכי הגעה מפורטות יעודכנו בקרוב
                </span>
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
