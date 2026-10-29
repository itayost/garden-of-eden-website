"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { canDeleteSurvey } from "../permissions";
import { STAFF_MESSAGES } from "../staff-messages";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionOutcome,
} from "./staff-access";

/**
 * Deletes a Survey with its Questions, Responses and answers (they cascade).
 * An Admin may delete any Survey; a Branch manager only one nobody answered.
 */
export async function deleteSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  const db = createAdminClient();
  const survey = await loadEditableSurvey(db, viewer, surveyId);
  if ("error" in survey) return survey;
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
