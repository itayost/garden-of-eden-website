"use server";

import { loadAnswerableSurvey, requireSignedIn, TRAINEE_MESSAGES } from "./trainee-access";
import type { ActionOutcome } from "./staff-access";

/**
 * Records that the Trainee has seen an open Survey they are in the Audience
 * of. Idempotent: the first sight is kept, a second call changes nothing.
 */
export async function markSurveySeenAction(surveyId: string): Promise<ActionOutcome> {
  const signedIn = await requireSignedIn();
  if ("error" in signedIn) return signedIn;

  const access = await loadAnswerableSurvey(signedIn.userId, surveyId);
  if ("error" in access) return access;

  const { error } = await access.db.from("survey_views").upsert(
    { survey_id: access.survey.record.id, profile_id: signedIn.userId },
    { onConflict: "survey_id,profile_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[surveys] mark seen failed:", error.message);
    return { error: TRAINEE_MESSAGES.failed };
  }
  return { success: true };
}
