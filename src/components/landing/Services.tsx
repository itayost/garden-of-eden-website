"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  Check,
  Dumbbell,
  Footprints,
  HeartPulse,
  Infinity as InfinityIcon,
  MessageCircle,
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
  description: string;
  price: string;
  period: string;
  /** A derived per-session price, shown only where it is exact. */
  perSession?: string;
  cta: string;
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
    cta: "שליחת הודעה על המסלול",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול 2 אימונים בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  },
  {
    icon: Footprints,
    name: "אימון אחד בשבוע",
    description: "מנוי חודשי",
    price: "850",
    period: "לחודש",
    cta: "שליחת הודעה על המסלול",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על מסלול אימון אחד בשבוע. תודה!",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  },
  {
    icon: CalendarDays,
    name: "מסלול היכרות",
    description: "2 אימונים",
    price: "200",
    period: "להכיר את השיטה לפני שמצטרפים",
    cta: "קביעת אימון היכרות",
    whatsappMessage: "היי, אשמח לקבוע מסלול היכרות (2 אימונים). תודה!",
    features: ["2 אימונים", "היכרות עם השיטה ועם המאמנים"],
  },
  {
    icon: InfinityIcon,
    name: "ללא הגבלה",
    description: "מנוי חודשי",
    price: "1,650",
    period: "לחודש",
    cta: "שליחת הודעה על המסלול",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על המסלול ללא הגבלה. תודה!",
    features: ["אימונים ללא הגבלה", "כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית ומנטלית"],
    highlighted: true,
  },
  {
    icon: Ticket,
    name: "כרטיסיית 10 אימונים",
    description: "מנצלים בקצב שלכם",
    price: "2,100",
    period: "10 אימונים",
    perSession: "₪210 לאימון",
    cta: "שליחת הודעה על המסלול",
    whatsappMessage: "היי, אשמח לשמוע פרטים נוספים על כרטיסיית 10 אימונים. תודה!",
    features: ["הגבלת זמן רחבה"],
  },
];

const disciplines = ["כדורגל", "כושר", "אתלטיות", "פיתוח אישי"];

const pillars: { icon: LucideIcon; lines: [string, string] }[] = [
  { icon: HeartPulse, lines: ["בריאות", "ואנרגיה"] },
  { icon: Users, lines: ["אווירה טובה", "וחברים"] },
  { icon: Brain, lines: ["מנטלי", "ופיתוח אישי"] },
  { icon: Zap, lines: ["מהירות", "ואתלטיות"] },
  { icon: Volleyball, lines: ["כדורגל", "וטכניקה"] },
  { icon: Dumbbell, lines: ["כושר", "וכוח"] },
];

/** The poster's palette: a night pitch, a neon green, and gold for the unlimited plan. */
const NEON = "#7df25c";

const accents = {
  neon: {
    border: "border-[#7df25c]",
    text: "text-[#7df25c]",
    tick: "bg-[#7df25c]",
    glow: "shadow-[0_24px_48px_-24px_rgba(0,0,0,0.9),0_0_30px_-4px_rgba(125,242,92,0.32)]",
    badgeGlow: "shadow-[0_10px_26px_-8px_rgba(125,242,92,0.32),0_0_22px_rgba(125,242,92,0.32)]",
    surface: "bg-[linear-gradient(180deg,rgba(10,22,12,0.92),rgba(4,8,5,0.94))]",
    pill: "border-[#7df25c]/45",
    button: "border-[#7df25c]/60 text-[#7df25c] hover:bg-[#7df25c] focus-visible:outline-[#7df25c]",
  },
  gold: {
    border: "border-[#ffd84a]",
    text: "text-[#ffd84a]",
    tick: "bg-[#ffd84a]",
    glow: "shadow-[0_24px_48px_-24px_rgba(0,0,0,0.9),0_0_34px_-2px_rgba(255,216,74,0.3)]",
    badgeGlow: "shadow-[0_10px_26px_-8px_rgba(255,216,74,0.3),0_0_22px_rgba(255,216,74,0.3)]",
    surface: "bg-[linear-gradient(180deg,rgba(28,24,6,0.9),rgba(6,6,3,0.95))]",
    pill: "border-[#ffd84a]/45",
    button: "border-[#ffd84a]/60 text-[#ffd84a] hover:bg-[#ffd84a] focus-visible:outline-[#ffd84a]",
  },
};

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function PlanCard({ plan }: { plan: Plan }) {
  const Icon = plan.icon;
  const accent = plan.highlighted ? accents.gold : accents.neon;
  return (
    <article className="floodlight group relative w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] pt-[38px]">
      <div
        className={`absolute top-0 inset-x-0 mx-auto z-10 w-[76px] h-[76px] rounded-full bg-[#040805] border-2 ${accent.border} ${accent.badgeGlow} flex items-center justify-center`}
      >
        <Icon className={`w-[34px] h-[34px] ${accent.text}`} aria-hidden="true" />
      </div>

      <div
        className={`h-full flex flex-col text-center rounded-[20px] border-2 ${accent.border} ${accent.surface} ${accent.glow} px-7 pt-14 pb-6 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5`}
      >
        <h3 className="text-[1.75rem] font-black leading-tight text-balance">{plan.name}</h3>
        <p className="text-lg text-[#c9d8c6] mt-1">{plan.description}</p>

        <p className={`flex justify-center items-baseline gap-1.5 mt-2.5 font-black leading-none ${accent.text}`}>
          <span className="text-6xl md:text-[4.25rem] tracking-[-0.03em] tabular-nums">{plan.price}</span>
          <span className="text-[2.5rem]">₪</span>
        </p>
        <p className="text-lg text-[#c9d8c6] mt-1.5">{plan.period}</p>
        {plan.perSession && (
          <div>
            <span className={`inline-block mt-2 rounded-full border ${accent.pill} ${accent.text} px-3 py-0.5 text-[0.95rem]`}>
              {plan.perSession}
            </span>
          </div>
        )}

        <div className="h-px bg-[#f6fbf4]/55 mt-[22px] mb-[18px]" />

        <ul className="grid gap-2.5 text-start">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-lg">
              <span className={`flex-none w-[22px] h-[22px] rounded-full ${accent.tick} text-[#040805] flex items-center justify-center`}>
                <Check className="w-3.5 h-3.5" strokeWidth={3.2} aria-hidden="true" />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <a
            href={buildWhatsAppUrl(plan.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2.5 min-h-12 rounded-full border-[1.5px] font-bold text-[1.05rem] hover:text-[#040805] transition-colors duration-300 focus-visible:outline-3 focus-visible:outline-offset-4 ${accent.button}`}
          >
            <MessageCircle className="w-[18px] h-[18px]" aria-hidden="true" />
            {plan.cta}
          </a>
        </div>
      </div>
    </article>
  );
}

export function Services() {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="relative isolate overflow-hidden bg-[#040805] text-[#f6fbf4] px-4 pt-16 pb-14 md:pt-[88px] md:pb-[72px] selection:bg-[#7df25c] selection:text-[#040805]"
    >
      {/* Pitch backdrop */}
      <Image
        src="/landing/hero.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover object-[center_30%] opacity-[0.28] saturate-[0.6] contrast-[1.1]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(4,8,5,0.35)_0%,#040805_70%),linear-gradient(to_bottom,transparent_55%,#0b1a0e_100%)]"
        aria-hidden="true"
      />
      {/* Halfway line and center circle behind the cards */}
      <svg
        className="absolute inset-x-0 top-[380px] h-[760px] w-full -z-10 opacity-[0.16] pointer-events-none"
        viewBox="0 0 1200 760"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke={NEON}
        strokeWidth="2"
        aria-hidden="true"
      >
        <line x1="0" y1="380" x2="1200" y2="380" />
        <circle cx="600" cy="380" r="170" />
        <circle cx="600" cy="380" r="5" fill={NEON} />
      </svg>

      <div className="max-w-[1120px] mx-auto">
        <header className="grid justify-items-center gap-[18px] text-center">
          <Image
            src="/landing/logo-light.png"
            alt="גארדן אוף EDEN"
            loading="eager"
            width={108}
            height={121}
            className="drop-shadow-[0_6px_18px_rgba(125,242,92,0.25)]"
          />
          <span className="inline-block -skew-x-[10deg] bg-[#7df25c] px-[26px] py-1.5 shadow-[0_8px_24px_-6px_rgba(125,242,92,0.32)]">
            <span className="block skew-x-[10deg] text-2xl font-black leading-tight text-[#040805]">סניף חיפה</span>
          </span>
          <h2 id="services-title" className="font-black leading-[0.92] tracking-[-0.02em]">
            <span className="block text-5xl sm:text-7xl lg:text-[5.75rem]">מסלולי אימונים</span>
            <span className="block text-[3.25rem] sm:text-[4.75rem] lg:text-8xl text-[#7df25c] [text-shadow:0_6px_28px_rgba(125,242,92,0.45)]">
              נבחרים
            </span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3.5 text-lg md:text-2xl">
            <span className="hidden sm:block w-[72px] h-0.5 bg-[#7df25c]" aria-hidden="true" />
            {disciplines.map((item, i) => (
              <span key={item} className="flex items-center gap-3.5">
                {i > 0 && <span className="w-0.5 h-[22px] bg-[#7df25c]" aria-hidden="true" />}
                {item}
              </span>
            ))}
            <span className="hidden sm:block w-[72px] h-0.5 bg-[#7df25c]" aria-hidden="true" />
          </div>
        </header>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-11 md:gap-y-14 mt-[52px] md:mt-[72px]">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <ul className="grid grid-cols-3 md:grid-cols-6 gap-y-7 max-w-[1000px] mx-auto mt-[76px]">
          {pillars.map(({ icon: Icon, lines }, i) => (
            <li
              key={lines[0]}
              className={`flex flex-col items-center gap-2.5 px-2.5 py-1 text-center font-bold text-base md:text-lg leading-tight border-[#f6fbf4]/30 ${
                i === 0 ? "" : i === 3 ? "md:border-s" : "border-s"
              }`}
            >
              <Icon className="w-[38px] h-[38px] md:w-11 md:h-11 text-[#7df25c]" strokeWidth={1.75} aria-hidden="true" />
              <span>
                {lines[0]}
                <br />
                {lines[1]}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row items-stretch max-w-[920px] mx-auto mt-[60px] rounded-[28px] sm:rounded-full overflow-hidden bg-[#7df25c] text-[#040805] shadow-[0_18px_40px_-16px_rgba(125,242,92,0.32),0_0_36px_-6px_rgba(125,242,92,0.32)]">
          <a
            href={`tel:+${WHATSAPP_PHONE}`}
            className="flex-1 flex items-center justify-center gap-3.5 px-6 py-3 font-black text-[1.75rem] md:text-[2rem] tracking-[-0.01em] hover:bg-[#95f77a] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-[#040805]"
          >
            <span className="w-[46px] h-[46px] rounded-full bg-[#040805] flex items-center justify-center flex-none">
              <Phone className="w-[22px] h-[22px] text-[#f6fbf4]" aria-hidden="true" />
            </span>
            <span dir="ltr">{PHONE_DISPLAY}</span>
          </a>
          <span className="h-0.5 mx-6 sm:h-auto sm:w-0.5 sm:mx-0 sm:my-3.5 bg-[#040805]" aria-hidden="true" />
          <a
            href={buildWhatsAppUrl("היי, אשמח להירשם ולשמוע פרטים נוספים על מסלולי האימונים בחיפה. תודה!")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-3.5 px-6 py-3 font-black text-[1.3rem] md:text-[1.6rem] hover:bg-[#95f77a] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-[#040805]"
          >
            להרשמה ולפרטים נוספים
            <span className="w-[46px] h-[46px] rounded-full bg-[#040805] flex items-center justify-center flex-none">
              <ArrowLeft className="w-[22px] h-[22px] text-[#f6fbf4]" aria-hidden="true" />
            </span>
          </a>
        </div>

        <p className="text-center mt-[26px] text-[1.05rem] text-[#c9d8c6]">
          <b className="text-[#f6fbf4]">סניף חיפה</b> · רחוב המלך שלמה 57, חיפה
        </p>
        <p className="text-center mt-2 text-sm text-[#c9d8c6]/75">* כל האימונים משולבים עם כדור</p>
      </div>
    </section>
  );
}
