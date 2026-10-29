"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitSurveyResponseAction } from "../../lib/actions/submit-survey";
import { SUBMIT_FAILED_MESSAGE } from "../../lib/answers";
import { answersToSend, type AnswerMap } from "../../lib/popup-answers";
import type { OfferableSurvey } from "../../lib/types";

/** The server's refusal text, or null when the answers were saved. A thrown action reads as a failed send. */
async function sendAnswers(survey: OfferableSurvey, answers: AnswerMap): Promise<string | null> {
  try {
    const outcome = await submitSurveyResponseAction({
      surveyId: survey.id,
      answers: answersToSend(survey.questions, answers),
    });
    return "error" in outcome ? outcome.error : null;
  } catch {
    return SUBMIT_FAILED_MESSAGE;
  }
}

/**
 * Where the Trainee is in one Survey and what they have answered. Step 0 is the
 * intro, 1..n the Questions, n + 1 the thanks. A failed send keeps the answers
 * and the step, and says why; preview mode never calls the server.
 */
export function useSurveyFlow(
  survey: OfferableSurvey,
  mode: "live" | "preview",
  onSent?: () => void,
) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (next: number) => {
    setError(null);
    setStep(next);
  };

  async function send() {
    setSending(true);
    setError(null);
    if (mode === "live") {
      const problem = await sendAnswers(survey, answers);
      if (problem !== null) {
        setError(problem);
        setSending(false);
        return;
      }
      // The refresh drops the answered Survey from the list behind the sheet.
      router.refresh();
      onSent?.();
    }
    setSending(false);
    setStep(survey.questions.length + 1);
  }

  return { step, goTo, answers, setAnswers, sending, error, send };
}

export type SurveyFlowState = ReturnType<typeof useSurveyFlow>;
