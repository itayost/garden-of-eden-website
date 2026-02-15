"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PaymentButton } from "@/components/payments/PaymentButton";

const plans = [
  {
    name: "קורס דיגיטלי",
    description: "גישה מלאה לתוכן הדיגיטלי",
    price: "350",
    priceNumber: 350,
    period: "תשלום אחד",
    paymentType: "one_time" as const,
    features: [
      "קורס דיגיטלי מלא",
      "גישה לכל התכנים המוקלטים",
      "תוכניות אימון ביתי",
    ],
    extraFeatures: [],
    highlighted: false,
  },
  {
    name: "תוכנית בסיסית",
    description: "מעטפת מלאה לשחקן",
    price: "2,190",
    priceNumber: 2190,
    period: "תוקף 3 חודשים",
    paymentType: "one_time" as const,
    features: [
      "10 אימונים",
      "קורס דיגיטלי מתנה",
      "ליווי תזונה",
      "גישה לספורטרפיסת ופיזיוטרפיסת",
      "5 אימונים ביתיים למניעת פציעות",
      "מבדקי אתלטיקה כל רבעון",
    ],
    extraFeatures: [],
    highlighted: false,
  },
  {
    name: "תוכנית מתקדמים",
    description: "תוכנית בסיסית + אימונים במתחם",
    price: "1,450",
    priceNumber: 1450,
    period: "לחודש",
    paymentType: "recurring" as const,
    features: [
      "כל מה שבתוכנית בסיסית",
      "2 אימונים בשבוע במתחם",
      "מדידות גופניות חודשיות",
    ],
    extraFeatures: [],
    highlighted: true,
  },
  {
    name: "תוכנית PRO",
    description: "התוכנית המקיפה ביותר שלנו",
    price: "1,650",
    priceNumber: 1650,
    period: "לחודש",
    paymentType: "recurring" as const,
    features: [
      "כל מה שבתוכנית מתקדמים",
      "מפגש ניתוח וידאו עם אנליסט",
      "אימון מנטלי אחת לחודש",
    ],
    extraFeatures: [],
    highlighted: false,
  },
  {
    name: "פגישת ניתוח וידיאו",
    description: "מפגש ניתוח וידאו עם אנליסט",
    price: "450",
    priceNumber: 450,
    period: "חד פעמי",
    paymentType: "one_time" as const,
    features: [
      "ניתוח פעולות באמצעות וידאו מקצועי",
      "משוב לשיפור הבנה טקטית וטכנית",
      "הצבת יעדים לפי עמדת השחקן",
    ],
    extraFeatures: [],
    highlighted: false,
  },
];

export function Services() {
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedPlan(expandedPlan === index ? null : index);
  };

  return (
    <section id="services" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            תוכניות מנוי גמישות
          </h2>
          <p className="text-black/50 max-w-md mx-auto">
            בחרו את התוכנית שמתאימה לכם והתחילו את המסע לגרסה הטובה ביותר של עצמכם
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Recommended badge */}
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDEA68] text-black text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    מומלץ ע״י המאמנים
                  </span>
                </div>
              )}

              {/* Card */}
              <motion.div
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className={`rounded-3xl p-8 h-full flex flex-col transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-white border-2 border-[#CDEA68] shadow-lg"
                    : "bg-white border border-black/10 hover:border-black/20 hover:shadow-md"
                }`}
              >

                {/* Plan name */}
                <h3 className="text-xl font-bold text-black mb-2">{plan.name}</h3>
                <p className="text-black/50 text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-black">₪{plan.price}</span>
                  </div>
                  <span className="text-black/40 text-sm">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#CDEA68] mt-2 flex-shrink-0" />
                      <span className="text-black/70 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Expand button - only show if there are extra features */}
                {plan.extraFeatures.length > 0 && (
                  <button
                    onClick={() => toggleExpand(index)}
                    className="flex items-center gap-2 text-black/50 hover:text-black/70 text-sm mb-6 transition-colors"
                  >
                    <motion.span
                      animate={{ rotate: expandedPlan === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                    {expandedPlan === index ? "הסתר פרטים" : "הצג עוד פרטים"}
                  </button>
                )}

                {/* Extra features - expandable */}
                <AnimatePresence>
                  {expandedPlan === index && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 mb-6 overflow-hidden"
                    >
                      {plan.extraFeatures.map((feature) => (
                        <motion.li
                          key={feature}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-3"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-[#CDEA68]/60 mt-2 flex-shrink-0" />
                          <span className="text-black/60 text-sm">{feature}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>

                {/* CTA */}
                <div className="mt-auto pt-4">
                  <PaymentButton
                    planName={plan.name}
                    amount={plan.priceNumber}
                    description={plan.description}
                    paymentType={plan.paymentType}
                    variant={plan.highlighted ? "highlighted" : "default"}
                  />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-black/50 text-sm mt-8 space-y-1"
        >
          <p>* כל האימונים משולבים עם כדור</p>
          <p>* מתקדמים ו-PRO בהתחייבות ל-4 חודשים, ניתן לבטל בהתראה של 7 ימי עסקים לפני מועד התשלום</p>
        </motion.div>
      </div>
    </section>
  );
}
