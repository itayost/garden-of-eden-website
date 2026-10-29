"use client";

import { CalendarClock, ChevronLeft, ClipboardList, Clock, type LucideIcon } from "lucide-react";

import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import { questionCountLabel } from "../../lib/format";
import { durationLabel } from "../../lib/offer";
import type { OfferableSurvey } from "../../lib/types";
import { LevelPath } from "./LevelPath";
import { FAINT_TEXT, RAISED, SOFT_TEXT } from "./sheet-styles";
import { SheetBody, SheetButton, SheetFooter } from "./SheetParts";

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-full px-[11px] text-[13px]", RAISED, SOFT_TEXT)}>
      <Icon className="size-3.5 text-brand-lime" aria-hidden="true" />
      {children}
    </span>
  );
}

/** The first screen: what the Survey is, how long it takes, and what is ahead. */
export function IntroScreen({
  survey,
  onStart,
  onLater,
}: {
  survey: OfferableSurvey;
  onStart: () => void;
  onLater: () => void;
}) {
  const count = survey.questions.length;
  return (
    <>
      <SheetBody>
        <DialogTitle className="mt-1 mb-2 text-[29px] leading-[1.15] font-black tracking-tight text-balance">
          {survey.title}
        </DialogTitle>
        {survey.intro !== null && survey.intro.trim() !== "" && (
          <p className={cn("max-w-[34ch] text-base leading-relaxed whitespace-pre-line", SOFT_TEXT)}>
            {survey.intro}
          </p>
        )}
        <div className="mt-[18px] mb-[22px] flex flex-wrap gap-2">
          <Chip icon={ClipboardList}>{questionCountLabel(count)}</Chip>
          <Chip icon={Clock}>{durationLabel(count)}</Chip>
          {survey.closesOn !== null && (
            <Chip icon={CalendarClock}>{`פתוח עד ${shortDate(survey.closesOn)}`}</Chip>
          )}
        </div>
        <div className="mb-5 border-t border-brand-lime/15 pt-4">
          <LevelPath questions={survey.questions} current={0} size="large" />
          <div className={cn("mt-2.5 flex justify-between px-1 text-xs", FAINT_TEXT)}>
            <span>שאלה ראשונה</span>
            <span>סיום</span>
          </div>
        </div>
      </SheetBody>
      <SheetFooter className="space-y-1 pt-0">
        <SheetButton onClick={onStart}>
          יאללה, מתחילים
          <ChevronLeft aria-hidden="true" />
        </SheetButton>
        <SheetButton variant="ghost" onClick={onLater}>
          אחר כך
        </SheetButton>
        <p className={cn("text-center text-xs", FAINT_TEXT)}>הסקר יחכה לך מחר</p>
      </SheetFooter>
    </>
  );
}
