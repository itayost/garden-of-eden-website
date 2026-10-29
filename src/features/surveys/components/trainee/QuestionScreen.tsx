"use client";

import { ChevronLeft, Send } from "lucide-react";

import { DialogTitle } from "@/components/ui/dialog";
import { canContinue } from "../../lib/popup-answers";
import type { OfferableSurvey, SurveyQuestion } from "../../lib/types";
import { LevelPath } from "./LevelPath";
import { QuestionStep } from "./QuestionStep";
import { BackButton, CloseButton, SheetBody, SheetButton, SheetFooter, SheetTop } from "./SheetParts";
import type { SurveyFlowState } from "./useSurveyFlow";

/** "הבא", or "שליחה" on the last Question, with any error from sending under it. */
function QuestionFooter({
  question,
  isLast,
  flow,
}: {
  question: SurveyQuestion;
  isLast: boolean;
  flow: SurveyFlowState;
}) {
  const { step, goTo, answers, sending, error, send } = flow;
  return (
    <SheetFooter>
      <SheetButton
        disabled={sending || !canContinue(question, answers[question.id])}
        aria-busy={sending}
        onClick={isLast ? send : () => goTo(step + 1)}
      >
        {isLast ? "שליחה" : "הבא"}
        {isLast ? <Send aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
      </SheetButton>
      {error !== null && (
        <p role="alert" className="mt-3 text-center text-sm text-red-300">
          {error}
        </p>
      )}
    </SheetFooter>
  );
}

/**
 * One Question's screen: back, the level path and close on top, the Question
 * in the middle, the button pinned at the bottom. On a phone it fills the
 * sheet so the button rests at the bottom; from sm up the dialog is as tall as
 * its Question.
 */
export function QuestionScreen({
  survey,
  question,
  flow,
}: {
  survey: OfferableSurvey;
  question: SurveyQuestion;
  flow: SurveyFlowState;
}) {
  const { step, goTo, answers, setAnswers, sending } = flow;
  const total = survey.questions.length;
  return (
    <div className="relative flex h-[90svh] min-h-0 flex-col sm:h-auto">
      <DialogTitle className="sr-only">{survey.title}</DialogTitle>
      <SheetTop>
        {step > 1 ? (
          <BackButton onClick={() => goTo(step - 1)} disabled={sending} />
        ) : (
          <span aria-hidden="true" className="size-10 flex-none" />
        )}
        <LevelPath questions={survey.questions} current={step - 1} />
        <CloseButton />
      </SheetTop>
      <SheetBody>
        <QuestionStep
          key={question.id}
          question={question}
          number={step}
          total={total}
          answers={answers}
          onChange={setAnswers}
        />
      </SheetBody>
      <QuestionFooter question={question} isLast={step === total} flow={flow} />
    </div>
  );
}
