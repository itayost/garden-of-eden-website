"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { surveyDetailsSchema, type SurveyDetailsInput } from "@/lib/validations/surveys";
import { closeDateProblem, withBlankClosesOn } from "../staff-input";
import { STAFF_MESSAGES } from "../staff-messages";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionOutcome,
} from "./staff-access";

/**
 * Changes the title, intro and close date, which stay editable after the
 * first Response. Moving the close date later on a Survey that ended by date
 * opens it again until the new date. A Survey closed early stays closed.
 */
export async function updateSurveyDetailsAction(
  surveyId: string,
  details: SurveyDetailsInput,
): Promise<ActionOutcome> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;

  const db = createAdminClient();
  const survey = await loadEditableSurvey(db, staff.viewer, surveyId);
  if ("error" in survey) return survey;
  const { record } = survey;
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.closedNoEdit };

  const parsed = surveyDetailsSchema.safeParse(withBlankClosesOn(details));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? STAFF_MESSAGES.invalidInput };
  const data = parsed.data;
  const dateProblem = closeDateProblem(record.opensOn, data.closesOn, israelToday());
  if (dateProblem !== null) return { error: dateProblem };

  const { data: updated, error } = await db
    .from("surveys")
    .update({ title: data.title, intro: data.intro, closes_on: data.closesOn })
    .eq("id", record.id)
    .is("closed_at", null)
    .select("id");
  if (error) return writeFailed("details update", error.message);
  if ((updated ?? []).length === 0) return { error: STAFF_MESSAGES.changedMeanwhile };

  revalidateSurveyPages(record.id);
  return { success: true };
}
