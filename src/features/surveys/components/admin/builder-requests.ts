import { publishSurveyAction, unpublishSurveyAction } from "../../lib/actions/publish-survey";
import { saveSurveyDraftAction } from "../../lib/actions/save-survey";
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

export async function publishSaved(surveyId: string): Promise<Refusal> {
  try {
    const result = await publishSurveyAction(surveyId);
    return "error" in result ? splitProblems(result.error) : null;
  } catch {
    return [REQUEST_FAILED.publish];
  }
}

export async function unpublishSaved(surveyId: string): Promise<Refusal> {
  try {
    const result = await unpublishSurveyAction(surveyId);
    return "error" in result ? splitProblems(result.error) : null;
  } catch {
    return [REQUEST_FAILED.unpublish];
  }
}
