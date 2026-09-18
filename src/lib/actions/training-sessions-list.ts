"use server";

import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import {
  toDaySessionStatuses,
  type DaySessionStatuses,
  type SessionStatusRow,
} from "@/lib/schedule/day-session-status";
import {
  toRosterExercises,
  type RosterSession,
  type SessionExerciseRow,
} from "@/lib/schedule/roster-exercise";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString, isValidUUID } from "@/lib/validations/common";
import {
  SESSION_SELECT_WITH_EXERCISES,
  type SessionSummary,
  type TrainingSession,
} from "@/types/training-session";

/** One slot's roster; a larger list is a caller bug, not a page to serve. */
const MAX_ROSTER_TRAINEES = 60;

/**
 * The exercise lines the calendar's roster sheet shows — names and targets,
 * without the logs and equipment profiles the builder needs.
 */
const ROSTER_SESSION_SELECT =
  "id, trainee_id, completed_at, exercises:training_session_exercises(id, order_index, target_sets, target_reps_he, target_reps, target_load_he, target_weight_kg, target_duration_seconds, target_distance_m, notes_he, exercise:workout_exercises(name_he, name_en))";

type SessionResult =
  | { success: true; data: TrainingSession | null }
  | { error: string };

type SummariesResult =
  | { success: true; data: Record<string, SessionSummary> }
  | { error: string };

type RosterSessionsResult =
  | { success: true; data: Record<string, RosterSession> }
  | { error: string };

type StatusesResult = { success: true; data: DaySessionStatuses } | { error: string };

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
 * The built sessions of one slot's roster, exercise names included, so the
 * calendar's roster sheet can show what each trainee was given without
 * sending a trainer to the builder. Trainees with nothing built are absent
 * from the map rather than present and empty.
 */
export async function getRosterSessionsAction(
  date: string,
  traineeIds: string[],
): Promise<RosterSessionsResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!Array.isArray(traineeIds)) return { error: "קלט לא תקין" };
  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };
  if (traineeIds.length > MAX_ROSTER_TRAINEES) return { error: "יותר מדי מתאמנים בבקשה אחת" };
  if (!traineeIds.every(isValidUUID)) return { error: "מזהה מתאמן לא תקין" };
  if (traineeIds.length === 0) return { success: true, data: {} };

  // A server action is a public endpoint, so the ids the sheet sent are not a
  // control: a trainer reads only their own branches' trainees. An id outside
  // the scope is dropped rather than refused, so one stray roster row cannot
  // blank the whole sheet.
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  const visibleIds = await visibleProfileIds(createAdminClient(), scopeResult.data.scope, undefined);
  const scopedIds = visibleIds === null ? traineeIds : traineeIds.filter((id) => visibleIds.includes(id));
  if (scopedIds.length === 0) return { success: true, data: {} };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select(ROSTER_SESSION_SELECT)
    .eq("session_date", date)
    .in("trainee_id", scopedIds);

  if (error) {
    console.error("Get roster sessions error:", error);
    return { error: "שגיאה בטעינת האימונים" };
  }

  const rows = (data ?? []) as {
    id: string;
    trainee_id: string;
    completed_at: string | null;
    exercises: SessionExerciseRow[] | null;
  }[];

  return {
    success: true,
    data: Object.fromEntries(
      rows.map((row) => [
        row.trainee_id,
        {
          id: row.id,
          completed_at: row.completed_at,
          exercises: toRosterExercises(row.exercises ?? []),
        },
      ]),
    ),
  };
}

/**
 * Whether each trainee's session is built, across a range of days. The
 * calendar loads one week and switches day on the client, so a per-date read
 * would go stale the moment a trainer taps another day in the strip.
 *
 * Scoped by branch rather than by a caller-supplied id list: a trainer reads
 * the trainees of their own branches and no others.
 */
export async function getWeekSessionStatusesAction(
  startDate: string,
  endDate: string,
): Promise<StatusesResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return { error: "תאריך לא תקין" };
  if (endDate < startDate) return { error: "טווח תאריכים לא תקין" };

  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  const visibleIds = await visibleProfileIds(createAdminClient(), scopeResult.data.scope, undefined);
  if (visibleIds !== null && visibleIds.length === 0) return { success: true, data: {} };

  const supabase = await createClient();
  const query = typedFrom(supabase, "training_sessions")
    .select("trainee_id, session_date, completed_at, exercises:training_session_exercises(id)")
    .gte("session_date", startDate)
    .lte("session_date", endDate);

  const { data, error } = await (visibleIds === null ? query : query.in("trainee_id", visibleIds));

  if (error) {
    console.error("Get week session statuses error:", error);
    return { error: "שגיאה בטעינת סטטוס האימונים" };
  }

  return { success: true, data: toDaySessionStatuses((data ?? []) as SessionStatusRow[]) };
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
