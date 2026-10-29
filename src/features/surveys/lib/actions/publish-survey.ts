"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { toDraft } from "../draft-mapping";
import { publishProblem } from "../publish";
import { STAFF_MESSAGES } from "../staff-messages";
import { publishedOpensOn } from "../state";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionOutcome,
} from "./staff-access";

/** Joins every problem that stops a publish, so the builder can list them all. */
const PROBLEM_SEPARATOR = " · ";

/**
 * Publishes a draft once it passes the publish rules. A Survey published after
 * its open date opens today, not in the past.
 */
export async function publishSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  const db = createAdminClient();
  const survey = await loadEditableSurvey(db, viewer, surveyId);
  if ("error" in survey) return survey;
  const { record } = survey;
  if (record.publishedAt !== null) return { error: STAFF_MESSAGES.alreadyPublished };

  const today = israelToday();
  const problems = publishProblem(toDraft(record, survey.questions), today);
  if (problems.length > 0) return { error: problems.join(PROBLEM_SEPARATOR) };

  // The filter on published_at keeps a double click from publishing twice.
  const { data, error } = await db
    .from("surveys")
    .update({
      published_at: new Date().toISOString(),
      published_by: viewer.userId,
      opens_on: publishedOpensOn(record.opensOn, today),
    })
    .eq("id", record.id)
    .is("published_at", null)
    .select("id");
  if (error) return writeFailed("publish", error.message);
  if ((data ?? []).length === 0) return { error: STAFF_MESSAGES.changedMeanwhile };

  revalidateSurveyPages(record.id);
  return { success: true };
}

/** Returns a published Survey to draft, only before the first Response and while it is not closed. */
export async function unpublishSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;

  const db = createAdminClient();
  const survey = await loadEditableSurvey(db, staff.viewer, surveyId);
  if ("error" in survey) return survey;
  const { record } = survey;
  if (record.publishedAt === null) return { error: STAFF_MESSAGES.notPublished };
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.closedNoDraft };
  if (survey.responseCount > 0) return { error: STAFF_MESSAGES.unpublishHasResponses };

  const { data, error } = await db
    .from("surveys")
    .update({ published_at: null, published_by: null })
    .eq("id", record.id)
    .not("published_at", "is", null)
    .is("closed_at", null)
    .select("id");
  if (error) return writeFailed("unpublish", error.message);
  if ((data ?? []).length === 0) return { error: STAFF_MESSAGES.changedMeanwhile };

  revalidateSurveyPages(record.id);
  return { success: true };
}
