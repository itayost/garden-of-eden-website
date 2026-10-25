"use client";

import Image from "next/image";
import { m } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  Check,
  Dumbbell,
  Footprints,
  HeartPulse,
  Infinity as InfinityIcon,
  Phone,
  Ticket,
  Users,
  Volleyball,
  Zap,
  type LucideIcon,
} from "lucide-react";

const WHATSAPP_PHONE = "972525779446";
const PHONE_DISPLAY = "052-5779446";

type Plan = {
  icon: LucideIcon;
  name: string;
  description?: string;
  price: string;
  period?: string;
  whatsappMessage: string;
  features: string[];
  /** The gold card on the poster. */
  highlighted?: boolean;
};

/** The Haifa price list, in the order and wording of the branch's published poster. */
const plans: Plan[] = [
  {
    icon: Users,
    name: "2 אימונים בשבוע",
    description: "מנוי חודשי",
    price: "1,450",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול 2 אימונים בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  },
  {
    icon: Footprints,
    name: "אימון אחד בשבוע",
    description: "מנוי חודשי",
    price: "850",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול אימון אחד בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  },
  {
    icon: CalendarDays,
    name: "מסלול היכרות",
    description: "2 אימונים",
    price: "200",
    whatsappMessage: "היי, אשמח לקבוע מסלול היכרות (2 אימונים). תודה!",
    features: ["2 אימונים", "היכרות עם השיטה ועם המאמנים"],
  },
  {
    icon: Ticket,
    name: "כרטיסיית 10 אימונים",
    price: "2,100",
    period: "10 אימונים",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על כרטיסיית 10 אימונים. תודה!",
    features: ["הגבלת זמן רחבה"],
  },
  {
    icon: InfinityIcon,
    name: "ללא הגבלה",
    description: "מנוי חודשי",
    price: "1,650",
    period: "לחודש",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על המסלול ללא הגבלה. תודה!",
    features: ["אימונים ללא הגבלה", "כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית ומנטלית"],
    highlighted: true,
  },
];

const disciplines = ["כדורגל", "כושר", "אתלטיות", "פיתוח אישי"];

const pillars: { icon: LucideIcon; label: string }[] = [
  { icon: HeartPulse, label: "בריאות ואנרגיה" },
  { icon: Users, label: "אווירה טובה וחברים" },
  { icon: Brain, label: "מנטלי ופיתוח אישי" },
  { icon: Zap, label: "מהירות ואתלטיות" },
  { icon: Volleyball, label: "כדורגל וטכניקה" },
  { icon: Dumbbell, label: "כושר וכוח" },
];

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const Icon = plan.icon;
  const accent = plan.highlighted
    ? {
        border: "border-yellow-300",
        glow: "shadow-[0_0_28px_rgba(253,224,71,0.35)]",
        text: "text-yellow-300",
        check: "bg-yellow-300",
        button: "border-yellow-300/60 hover:bg-yellow-300 text-yellow-300",
      }
    : {
        border: "border-green-400",
        glow: "shadow-[0_0_28px_rgba(74,222,128,0.3)]",
        text: "text-green-400",
        check: "bg-green-400",
        button: "border-green-400/60 hover:bg-green-400 text-green-400",
      };

  return (
    <m.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="relative w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] pt-9"
    >
      {/* Icon badge sitting on the top border */}
      <div
        className={`absolute top-0 inset-x-0 mx-auto z-10 w-[72px] h-[72px] rounded-full bg-black border-2 ${accent.border} ${accent.glow} flex items-center justify-center`}
      >
        <Icon className={`w-8 h-8 ${accent.text}`} aria-hidden="true" />
      </div>

      <div
        className={`h-full rounded-2xl border-2 ${accent.border} ${accent.glow} bg-black/75 backdrop-blur-sm px-6 pt-12 pb-6 flex flex-col text-center`}
      >
        <h3 className="text-2xl font-black text-white">{plan.name}</h3>
        {plan.description && <p className="text-white/80 mt-1">{plan.description}</p>}

        <div className="mt-3">
          <span className={`text-5xl font-black tracking-tight ${accent.text}`}>₪{plan.price}</span>
          {plan.period && <p className="text-white/80 mt-1">{plan.period}</p>}
        </div>

        <div className="h-px bg-white/60 my-5" />

        <ul className="space-y-2 text-start">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-white">
              <span
                className={`w-5 h-5 rounded-full ${accent.check} flex items-center justify-center flex-shrink-0`}
              >
                <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} aria-hidden="true" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <a
            href={buildWhatsAppUrl(plan.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full py-2.5 rounded-full border font-semibold transition-colors duration-300 hover:text-black flex items-center justify-center gap-2 ${accent.button}`}
          >
            לפרטים בוואטסאפ
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </m.div>
  );
}

export function Services() {
  return (
    <section id="services" className="relative overflow-hidden bg-black py-20">
      {/* Pitch backdrop */}
      <Image
        src="/landing/hero.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-25"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-[#04140a]" aria-hidden="true" />

      <div className="relative container mx-auto px-6">
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block -skew-x-6 bg-green-400 px-6 py-1.5 mb-5 shadow-[0_0_24px_rgba(74,222,128,0.5)]">
            <span className="block skew-x-6 text-xl md:text-2xl font-black text-black">סניף חיפה</span>
          </span>
          <h2 className="font-black leading-none">
            <span className="block text-5xl md:text-7xl text-white">מסלולי אימונים</span>
            <span className="block text-5xl md:text-7xl text-green-400 drop-shadow-[0_0_18px_rgba(74,222,128,0.5)]">
              נבחרים
            </span>
          </h2>
          <div className="flex items-center justify-center gap-3 md:gap-4 mt-6 text-white text-lg md:text-2xl">
            <span className="hidden sm:block h-0.5 w-12 md:w-24 bg-green-400" aria-hidden="true" />
            {disciplines.map((item, i) => (
              <span key={item} className="flex items-center gap-3 md:gap-4">
                {i > 0 && <span className="w-px h-6 bg-green-400" aria-hidden="true" />}
                {item}
              </span>
            ))}
            <span className="hidden sm:block h-0.5 w-12 md:w-24 bg-green-400" aria-hidden="true" />
          </div>
        </m.div>

        {/* Pricing cards */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <PlanCard key={plan.name} plan={plan} index={index} />
          ))}
        </div>

        {/* Pillars */}
        <m.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 md:grid-cols-6 gap-y-8 max-w-5xl mx-auto mt-16"
        >
          {pillars.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-2 px-2 text-center md:border-s md:first:border-s-0 border-white/30"
            >
              <Icon className="w-10 h-10 text-green-400" aria-hidden="true" />
              <span className="text-white font-semibold leading-tight">{label}</span>
            </li>
          ))}
        </m.ul>

        {/* Contact bar */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mt-14 rounded-full bg-green-400 shadow-[0_0_32px_rgba(74,222,128,0.45)] flex flex-col sm:flex-row items-stretch overflow-hidden text-black"
        >
          <a
            href={`tel:+${WHATSAPP_PHONE}`}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 font-black text-2xl md:text-3xl hover:bg-green-300 transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-black flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-white" aria-hidden="true" />
            </span>
            <span dir="ltr">{PHONE_DISPLAY}</span>
          </a>
          <span className="hidden sm:block w-0.5 my-3 bg-black" aria-hidden="true" />
          <a
            href={buildWhatsAppUrl("היי, אשמח להירשם ולשמוע פרטים נוספים על מסלולי האימונים בחיפה. תודה!")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 font-black text-xl md:text-2xl hover:bg-green-300 transition-colors"
          >
            להרשמה ולפרטים נוספים
            <span className="w-11 h-11 rounded-full bg-black flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-white" aria-hidden="true" />
            </span>
          </a>
        </m.div>

        <p className="text-center text-white/60 text-sm mt-8">* כל האימונים משולבים עם כדור</p>
      </div>
    </section>
  );
}
