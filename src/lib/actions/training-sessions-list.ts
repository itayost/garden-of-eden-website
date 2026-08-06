"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString, isValidUUID } from "@/lib/validations/common";
import {
  SESSION_SELECT_WITH_EXERCISES,
  type SessionSummary,
  type TrainingSession,
} from "@/types/training-session";

type SessionResult =
  | { success: true; data: TrainingSession | null }
  | { error: string };

type SummariesResult =
  | { success: true; data: Record<string, SessionSummary> }
  | { error: string };

function sortExercises(session: TrainingSession): TrainingSession {
  return {
    ...session,
    exercises: [...(session.exercises ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    ),
  };
}

/** The session of one trainee on one day, exercises included. Null = none built. */
export async function getSessionAction(
  traineeId: string,
  date: string,
): Promise<SessionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(traineeId)) return { error: "מזהה מתאמן לא תקין" };
  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select(SESSION_SELECT_WITH_EXERCISES)
    .eq("trainee_id", traineeId)
    .eq("session_date", date)
    .maybeSingle();

  if (error) {
    console.error("Get session error:", error);
    return { error: "שגיאה בטעינת האימון" };
  }

  return {
    success: true,
    data: data ? sortExercises(data as TrainingSession) : null,
  };
}

/**
 * Per-trainee session summaries for one day — drives the built/not-built
 * indicators on the schedule page's slot cards.
 */
export async function getSessionSummariesAction(
  date: string,
): Promise<SummariesResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select("id, trainee_id, completed_at, exercises:training_session_exercises(id)")
    .eq("session_date", date);

  if (error) {
    console.error("Get session summaries error:", error);
    return { error: "שגיאה בטעינת סטטוס האימונים" };
  }

  const rows = (data ?? []) as {
    id: string;
    trainee_id: string;
    completed_at: string | null;
    exercises: { id: string }[];
  }[];

  const summaries = Object.fromEntries(
    rows.map((row) => [
      row.trainee_id,
      {
        id: row.id,
        trainee_id: row.trainee_id,
        exerciseCount: row.exercises?.length ?? 0,
        completed_at: row.completed_at,
      },
    ]),
  );

  return { success: true, data: summaries };
}

/**
 * The trainee's most recent session before a date — the "שכפל אימון קודם"
 * source in the builder.
 */
export async function getPreviousSessionAction(
  traineeId: string,
  beforeDate: string,
): Promise<SessionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(traineeId)) return { error: "מזהה מתאמן לא תקין" };
  if (!isValidDateString(beforeDate)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select(SESSION_SELECT_WITH_EXERCISES)
    .eq("trainee_id", traineeId)
    .lt("session_date", beforeDate)
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Get previous session error:", error);
    return { error: "שגיאה בטעינת האימון הקודם" };
  }

  return {
    success: true,
    data: data ? sortExercises(data as TrainingSession) : null,
  };
}
