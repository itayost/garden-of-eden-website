"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_MESSAGES } from "../staff-messages";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionOutcome,
} from "./staff-access";

/** Closes a published Survey now. A Survey closed this way stays closed. */
export async function closeSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  const db = createAdminClient();
  const survey = await loadEditableSurvey(db, viewer, surveyId);
  if ("error" in survey) return survey;
  const { record } = survey;
  if (record.publishedAt === null) return { error: STAFF_MESSAGES.notPublished };
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.alreadyClosed };

  const { data, error } = await db
    .from("surveys")
    .update({ closed_at: new Date().toISOString(), closed_by: viewer.userId })
    .eq("id", record.id)
    .not("published_at", "is", null)
    .is("closed_at", null)
    .select("id");
  if (error) return writeFailed("close", error.message);
  if ((data ?? []).length === 0) return { error: STAFF_MESSAGES.changedMeanwhile };

  revalidateSurveyPages(record.id);
  return { success: true };
}
