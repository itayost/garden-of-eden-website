import Image from "next/image";
import {
  ArrowLeft,
  Brain,
  Dumbbell,
  HeartPulse,
  Phone,
  Users,
  Volleyball,
  Zap,
  type LucideIcon,
} from "lucide-react";

const NEON = "#7df25c";

const disciplines = ["כדורגל", "כושר", "אתלטיות", "פיתוח אישי"];

const pillars: { icon: LucideIcon; lines: [string, string] }[] = [
  { icon: HeartPulse, lines: ["בריאות", "ואנרגיה"] },
  { icon: Users, lines: ["אווירה טובה", "וחברים"] },
  { icon: Brain, lines: ["מנטלי", "ופיתוח אישי"] },
  { icon: Zap, lines: ["מהירות", "ואתלטיות"] },
  { icon: Volleyball, lines: ["כדורגל", "וטכניקה"] },
  { icon: Dumbbell, lines: ["כושר", "וכוח"] },
];

type PosterSectionProps = {
  /** Shown in the skewed tag above the headline, e.g. "סניף חיפה". */
  branchLabel: string;
  address: string;
  /** Digits only, international form, e.g. "972525779446". */
  phoneE164: string;
  phoneDisplay: string;
  /** The start-side half of the contact bar: a link and its label. */
  secondaryAction: { href: string; label: string; external: boolean };
  /** The plan cards. */
  children: React.ReactNode;
  /** One line under the disciplines, when the branch needs to explain how buying works. */
  intro?: string;
  /** Small print under the address. */
  notes: React.ReactNode;
};

/**
 * The price section in the look of the Haifa branch poster: a night pitch,
 * neon green cards, a pillars row, and a phone bar. Each branch passes its
 * own cards, contact details, and small print.
 */
export function PosterSection({
  branchLabel,
  address,
  phoneE164,
  phoneDisplay,
  secondaryAction,
  intro,
  children,
  notes,
}: PosterSectionProps) {
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
            <span className="block skew-x-[10deg] text-2xl font-black leading-tight text-[#040805]">{branchLabel}</span>
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
          {intro && <p className="max-w-xl text-lg text-[#c9d8c6] text-balance">{intro}</p>}
        </header>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-11 md:gap-y-14 mt-[52px] md:mt-[72px]">{children}</div>

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
            href={`tel:+${phoneE164}`}
            className="flex-1 flex items-center justify-center gap-3.5 px-6 py-3 font-black text-[1.75rem] md:text-[2rem] tracking-[-0.01em] hover:bg-[#95f77a] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-[#040805]"
          >
            <span className="w-[46px] h-[46px] rounded-full bg-[#040805] flex items-center justify-center flex-none">
              <Phone className="w-[22px] h-[22px] text-[#f6fbf4]" aria-hidden="true" />
            </span>
            <span dir="ltr">{phoneDisplay}</span>
          </a>
          <span className="h-0.5 mx-6 sm:h-auto sm:w-0.5 sm:mx-0 sm:my-3.5 bg-[#040805]" aria-hidden="true" />
          <a
            href={secondaryAction.href}
            {...(secondaryAction.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex-1 flex items-center justify-center gap-3.5 px-6 py-3 font-black text-[1.3rem] md:text-[1.6rem] hover:bg-[#95f77a] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-[#040805]"
          >
            {secondaryAction.label}
            <span className="w-[46px] h-[46px] rounded-full bg-[#040805] flex items-center justify-center flex-none">
              <ArrowLeft className="w-[22px] h-[22px] text-[#f6fbf4]" aria-hidden="true" />
            </span>
          </a>
        </div>

        <p className="text-center mt-[26px] text-[1.05rem] text-[#c9d8c6]">
          <b className="text-[#f6fbf4]">{branchLabel}</b> · {address}
        </p>
        <div className="text-center mt-2 text-sm text-[#c9d8c6]/75 space-y-1">{notes}</div>
      </div>
    </section>
  );
}
