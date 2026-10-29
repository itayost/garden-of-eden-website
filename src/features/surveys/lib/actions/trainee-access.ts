/**
 * The checks both Trainee Survey actions start with. Not a "use server" module
 * on purpose: exported from one, these would become endpoints a client could
 * call by name.
 */
import "server-only";

import { waitUntil } from "@vercel/functions";

import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import { inSurveyAudience } from "../audience";
import { SHARED_MESSAGES } from "../messages";
import { loadCandidate, loadSurvey, type LoadedSurvey } from "../queries";
import { surveyState } from "../state";
import type { ActionFailure, Db } from "./staff-access";

export const TRAINEE_MESSAGES = {
  signIn: "נדרשת התחברות",
  tooMany: "יותר מדי ניסיונות. נסו שוב בעוד דקה.",
  invalidId: SHARED_MESSAGES.invalidId,
  invalidInput: SHARED_MESSAGES.invalidInput,
  notFound: SHARED_MESSAGES.notFound,
  closed: SHARED_MESSAGES.closed,
  notForYou: SHARED_MESSAGES.notForYou,
  failed: "הפעולה נכשלה. נסו שוב.",
} as const;

/** The signed-in user's id, when there is one and they are under the rate limit. */
export async function requireSignedIn(): Promise<ActionFailure | { userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: TRAINEE_MESSAGES.signIn };

  const limit = await checkRateLimit(`survey:${user.id}`, "general");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: TRAINEE_MESSAGES.tooMany };
  return { userId: user.id };
}

/**
 * The Survey with its Questions, when the id is well formed, the Survey is
 * open today and the user is in its Audience. Staff and course-only profiles
 * are never in an Audience, so they are refused here too. The loaders log and
 * throw; a read that fails is answered with a generic refusal.
 */
export async function loadAnswerableSurvey(
  userId: string,
  surveyId: string,
): Promise<ActionFailure | { db: Db; survey: LoadedSurvey }> {
  if (!isValidUUID(surveyId)) return { error: TRAINEE_MESSAGES.invalidId };

  const db = createAdminClient();
  try {
    const survey = await loadSurvey(db, surveyId);
    if (survey === null) return { error: TRAINEE_MESSAGES.notFound };
    if (surveyState(survey.record, israelToday()) !== "open") {
      return { error: TRAINEE_MESSAGES.closed };
    }
    const candidate = await loadCandidate(db, userId);
    if (candidate === null || !inSurveyAudience(candidate, survey.record)) {
      return { error: TRAINEE_MESSAGES.notForYou };
    }
    return { db, survey };
  } catch (error) {
    console.error(
      "[surveys] trainee survey read failed:",
      error instanceof Error ? error.message : error,
    );
    return { error: TRAINEE_MESSAGES.failed };
  }
}
