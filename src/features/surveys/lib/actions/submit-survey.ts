"use server";

import { revalidatePath } from "next/cache";

import { surveySubmitSchema, type SurveySubmitInput } from "@/lib/validations/surveys";
import {
  answersProblem,
  SUBMIT_FAILED_MESSAGE,
  submitErrorMessage,
  toAnswerRows,
} from "../answers";
import { hebrewIssueMessage } from "../issue-message";
import type { ActionFailure, ActionOutcome } from "./staff-access";
import { loadAnswerableSurvey, requireSignedIn, TRAINEE_MESSAGES } from "./trainee-access";

/** The refusal for a failed submit_survey_response call; unexpected failures are logged. */
function submitFailure(error: { code: string; message: string }): ActionFailure {
  // The code rides along so a foreign-key failure is recognised by SQLSTATE too.
  const message = submitErrorMessage(`${error.code} ${error.message}`);
  if (message === SUBMIT_FAILED_MESSAGE) {
    console.error("[surveys] submit failed:", error.code, error.message);
  }
  return { error: message };
}

/**
 * A Trainee sends their answers. Everything is checked again here against
 * fresh reads: signed in, under the rate limit, the Survey open today, the
 * Trainee in its Audience, every answer valid. The Response and its answers
 * are then written together by submit_survey_response, which also refuses a
 * second Response and stamps the Trainee's branches itself.
 */
export async function submitSurveyResponseAction(
  input: SurveySubmitInput,
): Promise<ActionOutcome> {
  const signedIn = await requireSignedIn();
  if ("error" in signedIn) return signedIn;

  const parsed = surveySubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: hebrewIssueMessage(parsed.error.issues, TRAINEE_MESSAGES.invalidInput) };
  }
  const { surveyId, answers } = parsed.data;

  const access = await loadAnswerableSurvey(signedIn.userId, surveyId);
  if ("error" in access) return access;
  const { questions } = access.survey;

  const problem = answersProblem(questions, answers);
  if (problem !== null) return { error: problem };

  const { error } = await access.db.rpc("submit_survey_response", {
    p_survey_id: surveyId,
    p_profile_id: signedIn.userId,
    p_answers: toAnswerRows(questions, answers).map((row) => ({
      question_id: row.questionId,
      option_id: row.optionId,
      rating: row.rating,
      text: row.text,
    })),
  });
  if (error) return submitFailure(error);

  revalidatePath("/dashboard");
  return { success: true };
}
