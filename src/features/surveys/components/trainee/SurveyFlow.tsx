"use client";

import { DialogTitle } from "@/components/ui/dialog";
import type { OfferableSurvey } from "../../lib/types";
import { IntroScreen } from "./IntroScreen";
import { QuestionScreen } from "./QuestionScreen";
import { CloseButton, SheetTop } from "./SheetParts";
import { ThanksScreen } from "./ThanksScreen";
import { useSurveyFlow } from "./useSurveyFlow";

export interface SurveyFlowProps {
  survey: OfferableSurvey;
  firstName: string;
  /** Preview shows the screens and sends nothing. */
  mode: "live" | "preview";
  /** Hides the sheet: "אחר כך", the close button, Escape and "סגירה" all end here. */
  onClose: () => void;
  onSent?: () => void;
  /** A send began (true) or ended (false); the popup refuses to close while one is in flight. */
  onSendingChange?: (sending: boolean) => void;
}

/**
 * The screens of one Survey: the intro, one Question at a time, the thanks.
 * It lives inside the dialog content, so closing the sheet unmounts it and
 * half-filled answers are gone, which is intended: they are never saved.
 */
export function SurveyFlow({ survey, firstName, mode, onClose, onSent, onSendingChange }: SurveyFlowProps) {
  const flow = useSurveyFlow(survey, mode, { onSent, onSendingChange });
  const { step } = flow;
  const question = survey.questions[step - 1];

  if (step === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SheetTop>
          <CloseButton className="ms-auto" />
        </SheetTop>
        <IntroScreen survey={survey} onStart={() => flow.goTo(1)} onLater={onClose} />
      </div>
    );
  }

  if (question === undefined) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <DialogTitle className="sr-only">{survey.title}</DialogTitle>
        <SheetTop />
        <ThanksScreen
          firstName={firstName}
          questions={survey.questions}
          preview={mode === "preview"}
          onClose={onClose}
        />
      </div>
    );
  }

  return <QuestionScreen survey={survey} question={question} flow={flow} />;
}
