"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitSurveyResponseAction } from "../../lib/actions/submit-survey";
import { SUBMIT_FAILED_MESSAGE, surveyIsGone } from "../../lib/answers";
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

export interface FlowCallbacks {
  /** The answers are saved, after the router refresh is requested. */
  onSent?: () => void;
  /** A send began (true) or ended, saved or not (false). */
  onSendingChange?: (sending: boolean) => void;
}

/**
 * Where the Trainee is in one Survey and what they have answered. Step 0 is the
 * intro, 1..n the Questions, n + 1 the thanks. A failed send keeps the answers
 * and the step, and says why; preview mode never calls the server.
 *
 * A refusal that says the Survey is answered or closed also refreshes the
 * router, so the dashboard card and the next popup drop it; the sheet stays to
 * show the refusal.
 */
export function useSurveyFlow(
  survey: OfferableSurvey,
  mode: "live" | "preview",
  callbacks: FlowCallbacks = {},
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

  const setBusy = (busy: boolean) => {
    setSending(busy);
    callbacks.onSendingChange?.(busy);
  };

  async function send() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "live") {
        const problem = await sendAnswers(survey, answers);
        if (problem !== null) {
          setError(problem);
          if (surveyIsGone(problem)) router.refresh();
          return;
        }
        // The refresh drops the answered Survey from the list behind the sheet.
        router.refresh();
        callbacks.onSent?.();
      }
      setStep(survey.questions.length + 1);
    } finally {
      setBusy(false);
    }
  }

  return { step, goTo, answers, setAnswers, sending, error, send };
}

export type SurveyFlowState = ReturnType<typeof useSurveyFlow>;
