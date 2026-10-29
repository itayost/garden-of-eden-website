"use server";

import { canDeleteSurvey } from "../permissions";
import { STAFF_MESSAGES } from "../staff-messages";
import { loadForEdit, revalidateSurveyPages, writeFailed, type ActionOutcome } from "./staff-access";

/**
 * Deletes a Survey with its Questions, Responses and answers (they cascade).
 * An Admin may delete any Survey; a Branch manager only one nobody answered.
 */
export async function deleteSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const edit = await loadForEdit(surveyId);
  if ("error" in edit) return edit;
  const { db, viewer, survey } = edit;
  const { record } = survey;
  const allowed = canDeleteSurvey(
    viewer.role,
    viewer.managedBranchIds,
    record.branchIds,
    survey.responseCount,
  );
  if (!allowed) return { error: STAFF_MESSAGES.deleteHasResponses };

  const { error } = await db.from("surveys").delete().eq("id", record.id);
  if (error) return writeFailed("delete", error.message);

  revalidateSurveyPages(record.id);
  return { success: true };
}
