"use client";

import { m } from "framer-motion";
import { MessageCircle } from "lucide-react";

const WHATSAPP_PHONE = "972525779446";

/** The Haifa price list, as on the branch's published poster. */
const plans = [
  {
    name: "אימון אחד בשבוע",
    description: "מנוי חודשי",
    price: "850",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול אימון אחד בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית, מנטלית וטקטית"],
    highlighted: false,
  },
  {
    name: "ללא הגבלה",
    description: "מגיעים מתי שרוצים",
    price: "1,650",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על המסלול ללא הגבלה. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית ומנטלית"],
    highlighted: true,
  },
  {
    name: "מסלול היכרות",
    description: "2 אימונים להכיר את השיטה לפני שמצטרפים",
    price: "200",
    period: "2 אימונים",
    whatsappMessage: "היי, אשמח לקבוע מסלול היכרות (2 אימונים). תודה!",
    features: ["2 אימונים", "היכרות עם השיטה ועם המאמנים"],
    highlighted: false,
  },
  {
    name: "2 אימונים פרונטליים בשבוע",
    description: "מנוי חודשי",
    price: "1,450",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול 2 אימונים בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית, מנטלית וטקטית"],
    highlighted: false,
  },
  {
    name: "כרטיסיית 10 אימונים",
    description: "מנצלים בקצב שלכם",
    price: "2,100",
    period: "10 אימונים",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על כרטיסיית 10 אימונים. תודה!",
    features: ["10 אימונים", "הגבלת זמן רחבה"],
    highlighted: false,
  },
];

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export function Services() {
  return (
    <section id="services" className="py-20 bg-paper">
      <div className="container mx-auto px-6">
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            מסלולי אימון בחיפה
          </h2>
          <p className="text-black/60 max-w-md mx-auto">
            כדורגל, כוח ואתלטיקה, תזונה, מנטלי וטקטי. בחרו את המסלול שמתאים לכם
          </p>
        </m.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <m.div
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-lime text-black text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    מומלץ ע״י המאמנים
                  </span>
                </div>
              )}

              {/* Card */}
              <m.div
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className={`rounded-3xl p-8 h-full flex flex-col transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-white border-2 border-brand-lime shadow-lg"
                    : "bg-white border border-black/10 hover:border-black/20 hover:shadow-md"
                }`}
              >
                {/* Plan name */}
                <h3 className="text-xl font-bold text-black mb-2">{plan.name}</h3>
                <p className="text-black/60 text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-black">₪{plan.price}</span>
                  </div>
                  <span className="text-black/60 text-sm">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-lime mt-2 flex-shrink-0" />
                      <span className="text-black/70 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto pt-4">
                  <a
                    href={buildWhatsAppUrl(plan.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb855] text-ink"
                  >
                    <MessageCircle className="w-4 h-4" />
                    שלחו הודעה בוואטסאפ
                  </a>
                </div>
              </m.div>
            </m.div>
          ))}
        </div>

        {/* Bottom note */}
        <m.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-black/60 text-sm mt-8"
        >
          <p>* כל האימונים משולבים עם כדור</p>
        </m.div>
      </div>
    </section>
  );
}
