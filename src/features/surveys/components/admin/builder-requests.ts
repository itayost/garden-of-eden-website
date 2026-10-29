import { saveSurveyDraftAction } from "../../lib/actions/save-survey";
import type { ActionOutcome } from "../../lib/actions/staff-access";
import type { SurveyDraft } from "../../lib/types";
import { REQUEST_FAILED, splitProblems } from "./builder-messages";

export type SaveOutcome = { surveyId: string } | { errors: string[] };

/** Saves the draft (a new Survey when `surveyId` is null). A request that throws reads as a failed save. */
export async function saveDraft(surveyId: string | null, draft: SurveyDraft): Promise<SaveOutcome> {
  try {
    const result = await saveSurveyDraftAction(surveyId, draft);
    return "error" in result ? { errors: splitProblems(result.error) } : { surveyId: result.surveyId };
  } catch {
    return { errors: [REQUEST_FAILED.save] };
  }
}

/** The reasons a request was refused, or null when it went through. */
export type Refusal = string[] | null;

/**
 * Sends a request that answers success or a refusal. A request that throws
 * reads as `failedMessage`, so a lost connection is told like any other failure.
 */
export async function refusalOf(
  call: () => Promise<ActionOutcome>,
  failedMessage: string,
): Promise<Refusal> {
  try {
    const result = await call();
    return "error" in result ? splitProblems(result.error) : null;
  } catch {
    return [failedMessage];
  }
}
