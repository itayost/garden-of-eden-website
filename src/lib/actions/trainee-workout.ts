"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import {
  exerciseLogSchema,
  type ExerciseLogInput,
} from "@/lib/validations/exercise-log";
import { isValidUUID } from "@/lib/validations/common";
import type { ExerciseLog } from "@/types/equipment";
import type { TrainingSession } from "@/types/training-session";

/**
 * Trainee-facing actions. Every query runs on the user-scoped client, so RLS
 * is the enforcement: a trainee only ever reads/writes his own rows. Staff
 * calling these acts on their own (empty) data — harmless.
 */

/** Session + exercises + the caller's logs, one embed. */
const MY_SESSION_SELECT =
  "*, exercises:training_session_exercises(id, session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment, equipment_id, cues_he), logs:exercise_logs(id, sets, reps, weight_kg, note_he, logged_at))";

type MySessionResult =
  | { success: true; data: TrainingSession | null }
  | { error: string };

type LogResult = { success: true; data: ExerciseLog } | { error: string };

type CompleteResult = { success: true } | { error: string };

/** The caller's own session for today (Israel date). Null = nothing built. */
export async function getMyTodaySessionAction(): Promise<MySessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select(MY_SESSION_SELECT)
    .eq("trainee_id", user.id)
    .eq("session_date", israelToday())
    .maybeSingle();

  if (error) {
    console.error("Get my session error:", error);
    return { error: "שגיאה בטעינת האימון" };
  }

  if (!data) return { success: true, data: null };

  const session = data as TrainingSession;
  return {
    success: true,
    data: {
      ...session,
      exercises: [...(session.exercises ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    },
  };
}

/**
 * Records what the trainee did on one exercise. When a log already exists for
 * the same session exercise, it is UPDATED — one row per exercise per session,
 * and re-logging corrects the entry rather than duplicating it.
 */
export async function logExerciseAction(input: ExerciseLogInput): Promise<LogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const validated = exerciseLogSchema.safeParse(input);
  if (!validated.success) {
    const flat = validated.error.flatten().fieldErrors;
    const firstError = Object.values(flat).flat()[0];
    return { error: firstError ?? "אימות נתונים נכשל" };
  }

  const { exerciseId, sessionExerciseId, equipmentId, sets, reps, weightKg, note } =
    validated.data;

  // Ownership check mirroring the RLS policy: the session exercise, when
  // given, must belong to the caller's own session AND prescribe this
  // exercise. RLS enforces the same at the DB layer; checking here turns a
  // forged or stale reference into a clear Hebrew error instead of a
  // constraint violation.
  if (sessionExerciseId) {
    const { data: owned } = await typedFrom(supabase, "training_session_exercises")
      .select("id, exercise_id, session:training_sessions!inner(trainee_id)")
      .eq("id", sessionExerciseId)
      .eq("session.trainee_id", user.id)
      .maybeSingle();

    if (!owned || owned.exercise_id !== exerciseId) {
      return { error: "התרגיל לא נמצא באימון שלך" };
    }
  }

  const updateExisting = async (): Promise<LogResult> => {
    const { data: existing } = await typedFrom(supabase, "exercise_logs")
      .select("id, equipment_id, note_he")
      .eq("session_exercise_id", sessionExerciseId)
      .eq("trainee_id", user.id)
      .maybeSingle();

    if (!existing) return { error: "שגיאה בשמירת הרישום" };

    // Corrections from the list arrive without equipment/note context —
    // overwriting with null would erase the original scan attribution.
    const { data: updated, error } = await typedFrom(supabase, "exercise_logs")
      .update({
        sets,
        reps,
        weight_kg: weightKg,
        note_he: note ?? existing.note_he,
        equipment_id: equipmentId ?? existing.equipment_id,
        logged_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !updated) {
      console.error("Update exercise log error:", error);
      return { error: "שגיאה בעדכון הרישום" };
    }

    revalidatePath("/dashboard/workout");
    return { success: true, data: updated as ExerciseLog };
  };

  if (sessionExerciseId) {
    const { data: existing } = await typedFrom(supabase, "exercise_logs")
      .select("id")
      .eq("session_exercise_id", sessionExerciseId)
      .eq("trainee_id", user.id)
      .maybeSingle();

    if (existing) return updateExisting();
  }

  const { data: created, error } = await typedFrom(supabase, "exercise_logs")
    .insert({
      trainee_id: user.id,
      exercise_id: exerciseId,
      session_exercise_id: sessionExerciseId,
      equipment_id: equipmentId,
      sets,
      reps,
      weight_kg: weightKg,
      note_he: note,
    })
    .select()
    .single();

  if (error || !created) {
    // Lost a double-tap race on the partial unique index: another insert for
    // the same session exercise landed first. Treat as a correction.
    if (sessionExerciseId && (error as { code?: string } | null)?.code === "23505") {
      return updateExisting();
    }
    console.error("Create exercise log error:", error);
    return { error: "שגיאה בשמירת הרישום" };
  }

  revalidatePath("/dashboard/workout");
  return { success: true, data: created as ExerciseLog };
}

/**
 * Marks the caller's own session complete.
 *
 * The ownership check runs on the user-scoped client (RLS returns only own
 * sessions); the write then goes through the admin client because trainees
 * deliberately have no UPDATE policy on training_sessions — RLS cannot
 * restrict columns, and a general trainee write could alter built_by or the
 * exercise targets. This action is the narrow completion path instead.
 */
export async function completeMySessionAction(
  sessionId: string,
): Promise<CompleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  if (!isValidUUID(sessionId)) return { error: "מזהה אימון לא תקין" };

  const { data: session } = await typedFrom(supabase, "training_sessions")
    .select(
      "id, trainee_id, completed_at, exercises:training_session_exercises(id, logs:exercise_logs(id))",
    )
    .eq("id", sessionId)
    .eq("trainee_id", user.id)
    .maybeSingle();

  if (!session) return { error: "האימון לא נמצא" };
  if (session.completed_at) return { success: true };

  // Completion means every exercise has a log — enforced here, not just by
  // the disabled button, or a direct call could show staff a completed
  // session with nothing done.
  const exercises = (session.exercises ?? []) as { id: string; logs: { id: string }[] }[];
  const unlogged = exercises.filter((exercise) => exercise.logs.length === 0);
  if (exercises.length === 0 || unlogged.length > 0) {
    return { error: `נשארו ${unlogged.length || exercises.length} תרגילים ללא רישום` };
  }

  const adminClient = createAdminClient();
  const { error } = await typedFrom(adminClient, "training_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("trainee_id", user.id);

  if (error) {
    console.error("Complete session error:", error);
    return { error: "שגיאה בסיום האימון" };
  }

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard");
  revalidatePath("/admin/schedule");
  return { success: true };
}

/** Resolves a scanned code to active equipment. Any signed-in user. */
export async function resolveEquipmentCodeAction(code: string): Promise<
  | { success: true; data: { id: string; name_he: string } | null }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 32) return { success: true, data: null };

  const { data, error } = await typedFrom(supabase, "equipment")
    .select("id, name_he")
    .eq("code", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Resolve equipment code error:", error);
    return { error: "שגיאה בזיהוי הציוד" };
  }

  return { success: true, data: data ?? null };
}

/** Exercises linked to one equipment, for the free-log path after a scan. */
export async function getEquipmentExercisesAction(equipmentId: string): Promise<
  | {
      success: true;
      data: { id: string; name_he: string | null; name_en: string | null }[];
    }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  if (!isValidUUID(equipmentId)) return { error: "מזהה ציוד לא תקין" };

  const { data, error } = await typedFrom(supabase, "workout_exercises")
    .select("id, name_he, name_en")
    .eq("equipment_id", equipmentId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Get equipment exercises error:", error);
    return { error: "שגיאה בטעינת התרגילים" };
  }

  return { success: true, data: data ?? [] };
}
