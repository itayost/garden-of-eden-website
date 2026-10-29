"use client";

import { useId, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { dayMonth, questionCountLabel } from "../../lib/format";
import type { OfferableSurvey } from "../../lib/types";
import { PitchMark } from "./PitchMark";
import { recordSeen } from "./record-seen";
import { SOFT_TEXT } from "./sheet-styles";
import { SurveyPopup } from "./SurveyPopup";

function detailsLine(survey: OfferableSurvey): string {
  const count = questionCountLabel(survey.questions.length);
  return survey.closesOn === null ? count : `${count} · נסגר ב-${dayMonth(survey.closesOn)}`;
}

function SurveyRow({
  survey,
  onAnswer,
}: {
  survey: OfferableSurvey;
  onAnswer: (survey: OfferableSurvey) => void;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-xl bg-forest-light p-3">
      <div className="min-w-0">
        <p className="text-[15px] font-bold">{survey.title}</p>
        <p className={cn("text-[12.5px]", SOFT_TEXT)}>{detailsLine(survey)}</p>
      </div>
      <button
        type="button"
        aria-label={`לענות על הסקר: ${survey.title}`}
        onClick={() => onAnswer(survey)}
        className="ms-auto flex h-11 flex-none items-center gap-1 rounded-xl bg-brand-lime px-3.5 text-sm font-extrabold text-forest transition-colors hover:bg-brand-lime-hover"
      >
        לענות
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * The dashboard's list of open Surveys the Trainee has not answered, so a
 * "later" at the popup is never a way to lose one. Same forest and lime as the
 * popup. Renders nothing for an empty list.
 *
 * The Survey being answered is kept in state: once it is sent the page refreshes
 * and the list loses it, but the thank-you must stay on screen until it is closed.
 */
export function OpenSurveysCard({
  surveys,
  firstName,
}: {
  surveys: OfferableSurvey[];
  firstName: string;
}) {
  const headingId = useId();
  const [active, setActive] = useState<OfferableSurvey | null>(null);
  const [open, setOpen] = useState(false);

  const answer = (survey: OfferableSurvey) => {
    setActive(survey);
    setOpen(true);
    recordSeen(survey.id);
  };

  return (
    <>
      {surveys.length > 0 && (
        <section
          aria-labelledby={headingId}
          className="relative overflow-hidden rounded-2xl bg-forest p-1.5 text-[#F2F5EA]"
        >
          <PitchMark className="-top-[130px] -end-[110px] size-[260px] opacity-[0.08]" />
          <h2
            id={headingId}
            className="relative mx-3 mt-2.5 mb-2 flex items-center gap-2 text-[15px] font-extrabold"
          >
            סקרים מחכים לך
            <span className="min-w-[22px] rounded-full bg-brand-lime px-[7px] text-center text-xs leading-[22px] tabular-nums text-forest">
              {surveys.length}
            </span>
          </h2>
          <ul className="relative space-y-1.5">
            {surveys.map((survey) => (
              <SurveyRow key={survey.id} survey={survey} onAnswer={answer} />
            ))}
          </ul>
        </section>
      )}
      {active !== null && (
        <SurveyPopup
          key={active.id}
          survey={active}
          firstName={firstName}
          mode="live"
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
