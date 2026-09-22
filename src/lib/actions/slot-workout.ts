"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchReadable } from "@/lib/actions/shared/assert-branch";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type { FanoutCounts } from "@/lib/schedule/slot-workout-fanout";
import { isValidUUID } from "@/lib/validations/common";
import {
  saveSlotWorkoutSchema,
  type SaveSlotWorkoutInput,
} from "@/lib/validations/slot-workout";
import {
  SLOT_WORKOUT_SELECT,
  type ScheduleSlot,
  type SlotWorkout,
  type SlotWorkoutExercise,
} from "@/types/schedule";

/**
 * The group workout of one slot: everyone booked into that hour does the same
 * thing, and saving it writes a personal session for each of them.
 *
 * Every write is one RPC, so the exercise list, the slot stamp and the fan-out
 * land together or not at all. The RPCs are not SECURITY DEFINER: staff
 * already hold a FOR ALL policy on training_sessions, and that stays the gate.
 */

type WorkoutResult = { success: true; data: SlotWorkout } | { error: string };

type SaveResult =
  | { success: true; data: { counts: FanoutCounts } }
  | { error: string; fieldErrors?: Record<string, string[]> };

type ClearResult = { success: true; data: { removed: number } } | { error: string };

/** Minimal typed shape for RPCs missing from the generated Supabase types. */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type SlotRow = ScheduleSlot & {
  exercises: SlotWorkoutExercise[] | null;
  trainees: { trainee_id: string | null; cancelled_at: string | null }[] | null;
};

function toCounts(data: unknown): FanoutCounts {
  const rows = (data ?? []) as { action: string; trainee_count: number }[];
  return rows.reduce<FanoutCounts>(
    (counts, row) => ({ ...counts, [row.action]: row.trainee_count }),
    {},
  );
}

/**
 * The slot with its group workout and how many roster members a save would
 * reach. The roster comes through the same select rather than a second count,
 * so the number on screen and the number the fan-out acts on are one read.
 */
export async function getSlotWorkoutAction(slotId: string): Promise<WorkoutResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(
      `${SLOT_WORKOUT_SELECT}, trainees:daily_schedule_slot_trainees(trainee_id, cancelled_at)`,
    )
    .eq("id", slotId)
    .maybeSingle();

  if (error) {
    console.error("Get slot workout error:", error);
    return { error: "שגיאה בטעינת האימון הקבוצתי" };
  }

  const row = data as SlotRow | null;
  if (!row) return { error: "הסלוט לא נמצא" };

  if (row.branch_id) {
    const scopeCheck = await assertBranchReadable(row.branch_id);
    if (scopeCheck.error) return { error: scopeCheck.error };
  }

  const rosterCount = (row.trainees ?? []).filter(
    (entry) => entry.trainee_id !== null && entry.cancelled_at === null,
  ).length;

  return {
    success: true,
    data: {
      slot: row,
      // PostgREST does not order embedded rows, and the order is the workout.
      exercises: [...(row.exercises ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
      rosterCount,
    },
  };
}

/**
 * Saves the group workout and fans it out in one transaction.
 *
 * An empty exercise list means "remove the group workout", which is why the
 * schema allows it and why the two paths part here rather than in the screen:
 * the save button is one button, and what it means is this action's decision.
 */
export async function saveSlotWorkoutAction(
  input: SaveSlotWorkoutInput,
): Promise<SaveResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = saveSlotWorkoutSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { slotId, notes, exercises } = validated.data;

  if (exercises.length === 0) {
    const cleared = await clearSlotWorkoutAction(slotId);
    if ("error" in cleared) return { error: cleared.error };
    return { success: true, data: { counts: {} } };
  }

  // Existence and branch scope, before any write.
  const slotResult = await getSlotWorkoutAction(slotId);
  if ("error" in slotResult) return { error: slotResult.error };

  const supabase = await createClient();
  const rpcClient = supabase as unknown as RpcClient;

  const { data, error } = await rpcClient.rpc("save_slot_workout", {
    p_slot_id: slotId,
    p_notes: notes,
    p_built_by: user!.id,
    p_built_by_name: profile!.full_name ?? "מאמן",
    p_exercises: exercises.map((exercise, index) => ({
      exercise_id: exercise.exerciseId,
      order_index: index,
      target_sets: exercise.targetSets,
      target_reps_he: exercise.targetReps,
      target_load_he: exercise.targetLoad,
      target_reps: exercise.targetRepsNum,
      target_weight_kg: exercise.targetWeightKg,
      target_duration_seconds: exercise.targetDurationSeconds,
      target_distance_m: exercise.targetDistanceM,
      notes_he: exercise.notes,
    })),
  });

  if (error) {
    console.error("save_slot_workout failed:", error);
    return { error: "שגיאה בשמירת האימון הקבוצתי" };
  }

  revalidateScheduleSurfaces();
  return { success: true, data: { counts: toCounts(data) } };
}

/**
 * Removes the group workout and the sessions it wrote. Never a session a
 * trainer edited individually and never a completed one: that exemption lives
 * in clear_slot_workout, so every path out of the feature honours it.
 */
export async function clearSlotWorkoutAction(slotId: string): Promise<ClearResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };

  const slotResult = await getSlotWorkoutAction(slotId);
  if ("error" in slotResult) return { error: slotResult.error };

  const supabase = await createClient();
  const rpcClient = supabase as unknown as RpcClient;

  const { data, error } = await rpcClient.rpc("clear_slot_workout", {
    p_slot_id: slotId,
  });

  if (error) {
    console.error("clear_slot_workout failed:", error);
    return { error: "שגיאה במחיקת האימון הקבוצתי" };
  }

  revalidateScheduleSurfaces();
  return { success: true, data: { removed: typeof data === "number" ? data : 0 } };
}
