"use client";

import { cn } from "@/lib/utils";
import type { SurveyQuestion } from "../../lib/types";
import { LevelPath } from "./LevelPath";
import { SOFT_TEXT } from "./sheet-styles";
import { SheetBody, SheetButton, SheetFooter } from "./SheetParts";
import { useFocusOnMount } from "./useFocusOnMount";

/**
 * A few pieces around the disc: offset from its start edge and top in pixels,
 * a colour and a tilt. The pieces pop in one after another; the stagger lives
 * in the inline delay.
 */
const CONFETTI: readonly { x: number; y: number; color: string; tilt: number }[] = [
  { x: -14, y: 4, color: "bg-brand-lime", tilt: -18 },
  { x: 118, y: 14, color: "bg-[#F2F5EA]", tilt: 24 },
  { x: -30, y: 62, color: "bg-gold", tilt: 40 },
  { x: 130, y: 70, color: "bg-brand-lime", tilt: -30 },
  { x: 10, y: 112, color: "bg-[#F2F5EA]", tilt: 12 },
  { x: 96, y: 116, color: "bg-gold", tilt: -12 },
  { x: 52, y: -22, color: "bg-brand-lime", tilt: 8 },
  { x: -40, y: 26, color: "bg-[#F2F5EA]", tilt: 60 },
];

const CONFETTI_FIRST_DELAY_S = 0.15;
const CONFETTI_STAGGER_S = 0.04;

/** The lime disc with a check that draws in, and the confetti. Both stop under reduced motion. */
function Win() {
  return (
    <div className="relative mx-auto mt-1.5 mb-[22px] size-28" aria-hidden="true">
      {CONFETTI.map((piece, index) => (
        <i
          key={index}
          className={cn("survey-confetti absolute h-3.5 w-2 rounded-sm", piece.color)}
          style={{
            insetInlineStart: piece.x,
            top: piece.y,
            rotate: `${piece.tilt}deg`,
            animationDelay: `${CONFETTI_FIRST_DELAY_S + index * CONFETTI_STAGGER_S}s`,
          }}
        />
      ))}
      <span className="survey-check absolute inset-0 grid place-items-center rounded-full bg-brand-lime text-forest shadow-[0_18px_30px_-14px_rgb(0_0_0/0.6)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[54px]"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    </div>
  );
}

/** The last screen: thanks by first name, every tile filled, and a way out. */
export function ThanksScreen({
  firstName,
  questions,
  preview,
  onClose,
}: {
  firstName: string;
  questions: readonly SurveyQuestion[];
  preview: boolean;
  onClose: () => void;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <SheetBody className="pt-6 text-center">
        <Win />
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-[30px] font-black tracking-tight outline-none"
        >
          תודה, {firstName}!
        </h3>
        <p className={cn("mx-auto mb-6 max-w-[30ch] text-base", SOFT_TEXT)}>
          {preview
            ? "תצוגה מקדימה, שום דבר לא נשלח."
            : "התשובות שלך נשלחו לצוות האקדמיה. נתראה באימון."}
        </p>
        <LevelPath questions={questions} current={questions.length} size="large" className="mb-5" />
      </SheetBody>
      <SheetFooter>
        <SheetButton variant="outline" onClick={onClose}>
          סגירה
        </SheetButton>
      </SheetFooter>
    </>
  );
}
