"use client";

import { m } from "framer-motion";
import { MessageCircle, Phone, MapPin, Clock, Bus } from "lucide-react";

export interface ContactLocation {
  address: string | null;
  mapEmbedUrl: string | null;
  hours: string | null;
  whatsapp: string;
  phoneDisplay: string;
  transport: readonly { origin: string; route: string }[];
  moovitUrl: string | null;
}

const transportRoutes = [
  { origin: "ממרכז הכרמל", route: "אוטובוס קו 3" },
  { origin: "ממרכזית לב המפרץ", route: "אוטובוס קו 115" },
  { origin: "מיקנעם", route: "קו 180 למרכזית המפרץ, משם קו 115" },
  { origin: "מנהריה", route: "רכבת לחוף הכרמל → קו 115 → תחנת המלך שלמה" },
];

const HAIFA: ContactLocation = {
  address: "שלמה המלך 57, חיפה",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3353.273065290644!2d34.95703687613971!3d32.81152907364922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151dbb7b675e66cb%3A0x7a93f87c703bd9f7!2z15LXkNeo15PXnyDXkNeV16Ig16LXk9efIEdhcmRlbiBPZiBFZGVu!5e0!3m2!1sen!2sus!4v1769599490398!5m2!1sen!2sus",
  hours: "א׳-ה׳ 08:00-21:00",
  whatsapp: "972525779446",
  phoneDisplay: "052-577-9446",
  transport: transportRoutes,
  moovitUrl:
    "https://moovitapp.com/tripplan/israel-1/poi/Garden%20of%20Eden%2C%20%D7%A9%D7%9C%D7%9E%D7%94%20%D7%94%D7%9E%D7%9C%D7%9A%2057/t/he?customerId=4908&ref=16&metroSeoName=Israel&tll=32.81152907364922_34.95703787613971",
};

export function Contact({ location = HAIFA }: { location?: ContactLocation } = {}) {
  const hasMap = Boolean(location.mapEmbedUrl);
  return (
    <section id="contact" className="py-20 bg-paper">
      <div className="container mx-auto px-6">
        <div className={`grid gap-12 items-center ${hasMap ? "lg:grid-cols-2" : "max-w-3xl mx-auto"}`}>
          {hasMap && (
          <m.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="aspect-[4/3] rounded-3xl overflow-hidden relative bg-ink">
              <iframe
                src={location.mapEmbedUrl ?? undefined}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Garden of Eden - ${location.address ?? ""}`}
              />
            </div>
          </m.div>
          )}

          {/* Right - Contact form */}
          <m.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm text-black/60 mb-2 block">צור קשר</span>
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              יש לכם שאלה?
            </h2>
            <p className="text-black/60 mb-8">
              Garden of Eden מציע שירותים מותאמים אישית. צרו איתנו קשר ונחזור אליכם בהקדם!
            </p>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href={`https://wa.me/${location.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10 hover:border-brand-lime/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-lime/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-brand-lime" />
                </div>
                <div>
                  <span className="text-black/60 text-xs block">וואטסאפ</span>
                  <span className="text-black font-medium text-sm">שלחו הודעה</span>
                </div>
              </a>

              <a
                href={`tel:+${location.whatsapp}`}
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10 hover:border-brand-lime/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-lime/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-brand-lime" />
                </div>
                <div>
                  <span className="text-black/60 text-xs block">טלפון</span>
                  <span className="text-black font-medium text-sm">{location.phoneDisplay}</span>
                </div>
              </a>

              {location.hours && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10">
                <div className="w-10 h-10 rounded-xl bg-brand-lime/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-brand-lime" />
                </div>
                <div>
                  <span className="text-black/60 text-xs block">שעות פעילות</span>
                  <span className="text-black font-medium text-sm">{location.hours}</span>
                </div>
              </div>
              )}

              {location.address && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/10">
                <div className="w-10 h-10 rounded-xl bg-brand-lime/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-brand-lime" />
                </div>
                <div>
                  <span className="text-black/60 text-xs block">מיקום</span>
                  <span className="text-black font-medium text-sm">{location.address}</span>
                </div>
              </div>
              )}
            </div>

            {location.transport.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-black mb-4">דרכי הגעה בתחבורה ציבורית</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {location.transport.map((item) => (
                  <div key={item.origin} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-black/10">
                    <div className="w-10 h-10 rounded-xl bg-brand-lime/10 flex items-center justify-center flex-shrink-0">
                      <Bus className="w-5 h-5 text-brand-lime" />
                    </div>
                    <div>
                      <span className="text-black font-medium text-sm block">{item.origin}</span>
                      <span className="text-black/60 text-xs">{item.route}</span>
                    </div>
                  </div>
                ))}
              </div>

              {location.moovitUrl && (
              <a
                href={location.moovitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full p-4 bg-[#50af4c] hover:bg-[#45a041] text-white font-medium rounded-2xl transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                נווט עם Moovit
              </a>
              )}
            </div>
            )}
          </m.div>
        </div>
      </div>
    </section>
  );
}
