"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { surveyDraftSchema, type SurveyDraftInput } from "@/lib/validations/surveys";
import { toQuestionsPayload } from "../draft-mapping";
import { canEditSurvey } from "../permissions";
import { withBlankClosesOn } from "../staff-input";
import { saveErrorMessage, STAFF_MESSAGES } from "../staff-messages";
import type { SurveyViewer } from "../types";
import {
  loadEditableSurvey,
  requireSurveyStaff,
  revalidateSurveyPages,
  writeFailed,
  type ActionFailure,
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

/** A failed save: the function's own refusals in Hebrew, anything else logged. */
function saveFailure(dbMessage: string): ActionFailure {
  const known = saveErrorMessage(dbMessage);
  return known === null ? writeFailed("save", dbMessage) : { error: known };
}

/**
 * Saves a Survey as a draft, creating it when `surveyId` is null. The
 * Survey, its branches, Questions and options are replaced together by
 * save_survey_draft, which also refuses once a Response exists.
 */
export async function saveSurveyDraftAction(
  surveyId: string | null,
  draft: SurveyDraftInput,
): Promise<SaveSurveyResult> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  const parsed = surveyDraftSchema.safeParse(withBlankClosesOn(draft));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? STAFF_MESSAGES.invalidInput };
  const data = parsed.data;

  // Before the Survey is read, so a manager who named no branch is told so.
  const refusal = branchRefusal(viewer, data.branchIds);
  if (refusal !== null) return { error: refusal };

  const db = createAdminClient();
  if (surveyId !== null) {
    const existing = await loadEditableSurvey(db, viewer, surveyId);
    if ("error" in existing) return existing;
    if (existing.responseCount > 0) return { error: STAFF_MESSAGES.hasResponses };
  }

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
