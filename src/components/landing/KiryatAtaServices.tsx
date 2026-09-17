"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { PlanProduct } from "@/types/plans";
import { featuresFor, KIRYAT_ATA_LANDING, periodFor } from "../../../content/landing-kiryat-ata";

/**
 * The קריית אתא price cards, fed by plan_products so the landing page, the
 * catalog CMS, and /join never disagree on a price. Every card leads to the
 * signup and payment page with that product preselected.
 */
export function KiryatAtaServices({ products }: { products: PlanProduct[] }) {
  const { title, subtitle, highlightedSlug } = KIRYAT_ATA_LANDING.services;

  return (
    <section id="services" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-black/50 mb-2 block">{KIRYAT_ATA_LANDING.hero.eyebrow}</span>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">{title}</h2>
          <p className="text-black/50 max-w-md mx-auto">{subtitle}</p>
        </m.div>

        {products.length === 0 ? (
          <p className="text-center text-black/50">
            המחירון יתפרסם בקרוב. בינתיים אפשר לכתוב לנו בוואטסאפ.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {products.map((product, index) => {
              const highlighted = product.slug === highlightedSlug;
              return (
                <m.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDEA68] text-black text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-black" />
                        הכי פופולרי
                      </span>
                    </div>
                  )}
                  {product.once_per_trainee && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-white text-xs font-medium">
                        לשחקן חדש
                      </span>
                    </div>
                  )}

                  <m.div
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    className={`rounded-3xl p-8 h-full flex flex-col transition-all duration-300 ${
                      highlighted
                        ? "bg-white border-2 border-[#CDEA68] shadow-lg"
                        : "bg-white border border-black/10 hover:border-black/20 hover:shadow-md"
                    }`}
                  >
                    <h3 className="text-xl font-bold text-black mb-2">{product.name_he}</h3>
                    <p className="text-black/50 text-sm mb-6">{product.blurb_he ?? periodFor(product)}</p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-black">
                          ₪{product.price_ils.toLocaleString("he-IL")}
                        </span>
                      </div>
                      <span className="text-black/40 text-sm">{periodFor(product)}</span>
                    </div>

                    <ul className="space-y-3 mb-4">
                      {featuresFor(product).map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#CDEA68] mt-2 flex-shrink-0" />
                          <span className="text-black/70 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-4">
                      <Link
                        href={`/join?product=${product.id}`}
                        className={`w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                          highlighted
                            ? "bg-[#CDEA68] hover:bg-[#bdd85c] text-black"
                            : "bg-black hover:bg-black/80 text-white"
                        }`}
                      >
                        הצטרפו
                        <ArrowLeft className="w-4 h-4" />
                      </Link>
                    </div>
                  </m.div>
                </m.div>
              );
            })}
          </div>
        )}

        <m.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-black/50 text-sm mt-8 space-y-1"
        >
          <p>* המחירים בשקלים חדשים וכוללים מע&quot;מ. התשלום בכרטיס אשראי בעמוד תשלום מאובטח.</p>
          <p>
            * ביטול והחזר לפי{" "}
            <Link href="/cancellation-policy" className="underline">
              מדיניות ביטול העסקה
            </Link>
            .
          </p>
        </m.div>
      </div>
    </section>
  );
}
