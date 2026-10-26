import Link from "next/link";
import { ArrowLeft, Check, MessageCircle, type LucideIcon } from "lucide-react";

export type PosterPlan = {
  icon: LucideIcon;
  name: string;
  description: string;
  /** Already formatted, e.g. "1,450". The shekel sign is added after it. */
  price: string;
  period: string;
  /** A small pill under the period: an exact per-session price or a condition. */
  note?: string;
  features: readonly string[];
  /** The gold card on the poster. */
  highlighted?: boolean;
  cta: {
    label: string;
    href: string;
    /** WhatsApp links open in a new tab; internal links go through next/link. */
    kind: "whatsapp" | "join";
  };
};

/** The poster's accents: neon green for every plan, gold for the highlighted one. */
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
    solid: "bg-[#7df25c] hover:bg-[#95f77a] focus-visible:outline-[#7df25c]",
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
    solid: "bg-[#ffd84a] hover:bg-[#ffe27a] focus-visible:outline-[#ffd84a]",
  },
};

export function PosterPlanCard({ plan }: { plan: PosterPlan }) {
  const Icon = plan.icon;
  const accent = plan.highlighted ? accents.gold : accents.neon;
  // WhatsApp is an outlined invitation to talk; joining is a filled call to buy.
  const ctaClass = `flex items-center justify-center gap-2.5 min-h-12 rounded-full font-bold text-[1.05rem] transition-colors duration-300 focus-visible:outline-3 focus-visible:outline-offset-4 ${
    plan.cta.kind === "whatsapp"
      ? `border-[1.5px] hover:text-[#040805] ${accent.button}`
      : `text-[#040805] ${accent.solid}`
  }`;

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
        {plan.note && (
          <div>
            <span className={`inline-block mt-2 rounded-full border ${accent.pill} ${accent.text} px-3 py-0.5 text-[0.95rem]`}>
              {plan.note}
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
          {plan.cta.kind === "whatsapp" ? (
            <a href={plan.cta.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>
              <MessageCircle className="w-[18px] h-[18px]" aria-hidden="true" />
              {plan.cta.label}
            </a>
          ) : (
            <Link href={plan.cta.href} className={ctaClass}>
              {plan.cta.label}
              <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
