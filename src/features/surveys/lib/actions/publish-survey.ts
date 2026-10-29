"use server";

import { israelToday } from "@/lib/utils/tasks";
import { toDraft } from "../draft-mapping";
import { publishProblem } from "../publish";
import { PROBLEM_SEPARATOR } from "../staff-input";
import { STAFF_MESSAGES } from "../staff-messages";
import { publishedOpensOn } from "../state";
import { finishGuardedUpdate, loadForEdit, type ActionOutcome } from "./staff-access";

/**
 * Publishes a draft once it passes the publish rules. A Survey published after
 * its open date opens today, not in the past.
 */
export async function publishSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const edit = await loadForEdit(surveyId);
  if ("error" in edit) return edit;
  const { db, viewer, survey } = edit;
  const { record } = survey;
  if (record.publishedAt !== null) return { error: STAFF_MESSAGES.alreadyPublished };

  const today = israelToday();
  const problems = publishProblem(toDraft(record, survey.questions), today);
  if (problems.length > 0) return { error: problems.join(PROBLEM_SEPARATOR) };

  // The filter on published_at keeps a double click from publishing twice.
  const result = await db
    .from("surveys")
    .update({
      published_at: new Date().toISOString(),
      published_by: viewer.userId,
      opens_on: publishedOpensOn(record.opensOn, today),
    })
    .eq("id", record.id)
    .is("published_at", null)
    .select("id");
  return finishGuardedUpdate("publish", record.id, result);
}

/** Returns a published Survey to draft, only before the first Response and while it is not closed. */
export async function unpublishSurveyAction(surveyId: string): Promise<ActionOutcome> {
  const edit = await loadForEdit(surveyId);
  if ("error" in edit) return edit;
  const { db, survey } = edit;
  const { record } = survey;
  if (record.publishedAt === null) return { error: STAFF_MESSAGES.notPublished };
  if (record.closedAt !== null) return { error: STAFF_MESSAGES.closedNoDraft };
  if (survey.responseCount > 0) return { error: STAFF_MESSAGES.unpublishHasResponses };

  const result = await db
    .from("surveys")
    .update({ published_at: null, published_by: null })
    .eq("id", record.id)
    .not("published_at", "is", null)
    .is("closed_at", null)
    .select("id");
  return finishGuardedUpdate("unpublish", record.id, result);
}
