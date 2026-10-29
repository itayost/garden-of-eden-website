"use server";

import { STAFF_MESSAGES } from "../staff-messages";
import { finishGuardedUpdate, loadForEdit, type ActionOutcome } from "./staff-access";

/** Closes a published Survey now. A Survey closed this way stays closed. */
export async function closeSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const edit = await loadForEdit(surveyId);
  if ("error" in edit) return edit;
  const { db, viewer } = edit;
  const { record } = edit.survey;
  if (record.publishedAt === null) return { error: STAFF_MESSAGES.notPublished };
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.alreadyClosed };

  const result = await db
    .from("surveys")
    .update({ closed_at: new Date().toISOString(), closed_by: viewer.userId })
    .eq("id", record.id)
    .not("published_at", "is", null)
    .is("closed_at", null)
    .select("id");
  return finishGuardedUpdate("close", record.id, result);
}
