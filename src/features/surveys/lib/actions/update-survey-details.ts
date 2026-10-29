"use server";

import { israelToday } from "@/lib/utils/tasks";
import { surveyDetailsSchema, type SurveyDetailsInput } from "@/lib/validations/surveys";
import { hebrewIssueMessage } from "../issue-message";
import { closeDateChangeProblem, withBlankClosesOn } from "../staff-input";
import { STAFF_MESSAGES } from "../staff-messages";
import { finishGuardedUpdate, loadForEdit, type ActionOutcome } from "./staff-access";

/**
 * Changes the title, intro and close date, which stay editable after the
 * first Response. Moving the close date later on a Survey that ended by date
 * opens it again until the new date. A Survey closed early stays closed. The
 * close date is only checked when it changes, so a Survey that ended by date
 * can still be retitled.
 */
export async function updateSurveyDetailsAction(
  surveyId: string,
  details: SurveyDetailsInput,
): Promise<ActionOutcome> {
  const edit = await loadForEdit(surveyId);
  if ("error" in edit) return edit;
  const { db } = edit;
  const { record } = edit.survey;
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.closedNoEdit };

  const parsed = surveyDetailsSchema.safeParse(withBlankClosesOn(details));
  if (!parsed.success) {
    return { error: hebrewIssueMessage(parsed.error.issues, STAFF_MESSAGES.invalidInput) };
  }
  const data = parsed.data;
  const dateProblem = closeDateChangeProblem(record.opensOn, record.closesOn, data.closesOn, israelToday());
  if (dateProblem !== null) return { error: dateProblem };

  const result = await db
    .from("surveys")
    .update({ title: data.title, intro: data.intro, closes_on: data.closesOn })
    .eq("id", record.id)
    .is("closed_at", null)
    .select("id");
  return finishGuardedUpdate("details update", record.id, result);
}
