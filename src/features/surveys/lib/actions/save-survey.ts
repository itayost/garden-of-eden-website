"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { surveyDraftSchema, type SurveyDraftInput } from "@/lib/validations/surveys";
import { toQuestionsPayload } from "../draft-mapping";
import { hebrewIssueMessage } from "../issue-message";
import { canEditSurvey } from "../permissions";
import { saveRefusal, withBlankClosesOn, type StoredSurveyState } from "../staff-input";
import { saveErrorMessage, STAFF_MESSAGES } from "../staff-messages";
import type { SurveyViewer } from "../types";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionFailure,
  type Db,
} from "./staff-access";

export type SaveSurveyResult = { success: true; surveyId: string } | ActionFailure;

/**
 * Why the viewer may not write a draft for these branches, or null. A Branch
 * manager must name at least one branch and manage every one of them; an
 * Admin may keep a draft with no branch yet.
 */
function branchRefusal(viewer: SurveyViewer, branchIds: readonly string[]): string | null {
  if (viewer.role !== "admin" && branchIds.length === 0) return STAFF_MESSAGES.noBranch;
  return canEditSurvey(viewer.role, viewer.managedBranchIds, branchIds)
    ? null
    : STAFF_MESSAGES.notAllowed;
}

/**
 * What is stored for the Survey being overwritten, or null when the draft is
 * new. Refuses an id the viewer may not edit, as every staff action does.
 */
async function loadStoredState(
  db: Db,
  viewer: SurveyViewer,
  surveyId: string | null,
): Promise<ActionFailure | StoredSurveyState | null> {
  if (surveyId === null) return null;
  const existing = await loadEditableSurvey(db, viewer, surveyId);
  if ("error" in existing) return existing;
  return {
    publishedAt: existing.record.publishedAt,
    closedAt: existing.record.closedAt,
    responseCount: existing.responseCount,
  };
}

/** A failed save: the function's own refusals in Hebrew, anything else logged. */
function saveFailure(dbMessage: string): ActionFailure {
  const known = saveErrorMessage(dbMessage);
  return known === null ? writeFailed("save", dbMessage) : { error: known };
}

/**
 * Saves a Survey as a draft, creating it when `surveyId` is null. The
 * Survey, its branches, Questions and options are replaced together by
 * save_survey_draft, which also refuses once a Response exists. saveRefusal
 * judges the rest first: a closed Survey is not saved, and a published one
 * must stay publishable.
 */
export async function saveSurveyDraftAction(
  surveyId: string | null,
  draft: SurveyDraftInput,
): Promise<SaveSurveyResult> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  const parsed = surveyDraftSchema.safeParse(withBlankClosesOn(draft));
  if (!parsed.success) {
    return { error: hebrewIssueMessage(parsed.error.issues, STAFF_MESSAGES.invalidInput) };
  }
  const data = parsed.data;

  // Before the Survey is read, so a manager who named no branch is told so.
  const refusal = branchRefusal(viewer, data.branchIds);
  if (refusal !== null) return { error: refusal };

  const db = createAdminClient();
  const stored = await loadStoredState(db, viewer, surveyId);
  if (stored !== null && "error" in stored) return stored;
  const problem = saveRefusal(data, stored, israelToday());
  if (problem !== null) return { error: problem };

  const { data: savedId, error } = await db.rpc("save_survey_draft", {
    // The generated types mark every argument required; NULL creates a Survey,
    // and an empty intro or close date is stored as NULL.
    p_survey_id: surveyId as string,
    p_actor: viewer.userId,
    p_title: data.title,
    p_intro: data.intro as string,
    p_opens_on: data.opensOn,
    p_closes_on: data.closesOn as string,
    p_birth_years: data.birthYears,
    p_branch_ids: data.branchIds,
    p_questions: toQuestionsPayload(data.questions),
  });
  if (error) return saveFailure(error.message);
  if (!savedId) return writeFailed("save", "no survey id returned");

  revalidateSurveyPages(savedId);
  return { success: true, surveyId: savedId };
}
