/**
 * The checks every staff Survey action starts with, and the small helpers they
 * share. Not a "use server" module on purpose: exported from one, these would
 * become endpoints a client could call by name.
 */
import "server-only";

import { revalidatePath } from "next/cache";

import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { canEditSurvey, canUseSurveys } from "../permissions";
import { loadSurvey, type LoadedSurvey } from "../queries";
import { STAFF_MESSAGES } from "../staff-messages";
import type { SurveyViewer } from "../types";

type Db = ReturnType<typeof createAdminClient>;

export type ActionFailure = { error: string };

/** What an action that changes a Survey and returns nothing answers with. */
export type ActionOutcome = { success: true } | ActionFailure;

/**
 * The signed-in member of staff, when an Admin or a Branch manager (a Trainer
 * who manages a branch) is asking. Trainers without a managed branch have no
 * access to Surveys.
 */
export async function requireSurveyStaff(): Promise<ActionFailure | { viewer: SurveyViewer }> {
  const { error, user, profile } = await verifyAdminOrTrainer();
  if (error) return { error };
  const scope = await getBranchScopeAction();
  if ("error" in scope) return { error: scope.error };

  const viewer: SurveyViewer = {
    userId: user!.id,
    role: profile!.role,
    managedBranchIds: scope.data.managedBranchIds,
  };
  if (!canUseSurveys(viewer.role, viewer.managedBranchIds)) {
    return { error: STAFF_MESSAGES.staffOnly };
  }
  return { viewer };
}

/**
 * A read that may throw (the loaders log and throw), as a refusal the caller
 * returns instead of an error page.
 */
export async function readOrFail<T>(
  what: string,
  read: () => Promise<T>,
): Promise<ActionFailure | { value: T }> {
  try {
    return { value: await read() };
  } catch (error) {
    console.error(`[surveys] ${what} failed:`, error instanceof Error ? error.message : error);
    return { error: STAFF_MESSAGES.failed };
  }
}

/**
 * The Survey with its Questions, when the id is well formed, it exists and the
 * viewer may edit it: an Admin, or a manager of every branch in its Audience.
 */
export async function loadEditableSurvey(
  db: Db,
  viewer: SurveyViewer,
  surveyId: string,
): Promise<ActionFailure | LoadedSurvey> {
  if (!isValidUUID(surveyId)) return { error: STAFF_MESSAGES.invalidId };
  const read = await readOrFail("survey load", () => loadSurvey(db, surveyId));
  if ("error" in read) return read;

  const survey = read.value;
  if (survey === null) return { error: STAFF_MESSAGES.notFound };
  if (!canEditSurvey(viewer.role, viewer.managedBranchIds, survey.record.branchIds)) {
    return { error: STAFF_MESSAGES.notAllowed };
  }
  return survey;
}

/** Logs a failed write and answers with the generic Hebrew message. */
export function writeFailed(what: string, dbMessage: string): ActionFailure {
  console.error(`[surveys] ${what} failed:`, dbMessage);
  return { error: STAFF_MESSAGES.failed };
}

/** The pages that show a Survey: the list and its own page. */
export function revalidateSurveyPages(surveyId: string): void {
  revalidatePath("/admin/surveys");
  revalidatePath(`/admin/surveys/${surveyId}`);
}
