"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  sessionIdSchema,
  upsertSessionSchema,
  type UpsertSessionInput,
} from "@/lib/validations/training-session";
import type { TrainingSession } from "@/types/training-session";

type UpsertResult =
  | { success: true; data: { id: string } }
  | { error: string; fieldErrors?: Record<string, string[]> };

type DeleteResult = { success: true } | { error: string };

function revalidateSessions() {
  revalidatePath("/admin/schedule");
}

/**
 * Creates or replaces the session of one trainee on one day.
 *
 * Trainers build sessions, not just admins — verifyAdminOrTrainer, matching
 * the staff FOR ALL RLS policy. The exercise list is replaced atomically via
 * the replace_session_exercises RPC so a failure can never leave a session
 * with a lost or partial list.
 */
export async function upsertSessionAction(
  input: UpsertSessionInput,
): Promise<UpsertResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = upsertSessionSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { traineeId, sessionDate, slotId, notes, exercises } = validated.data;
  const supabase = await createClient();

  // The session must belong to a real, active trainee account — free-text
  // roster names have no account and cannot receive sessions.
  //
  // Admin client for this lookup only: no profiles RLS policy lets a TRAINER
  // read a trainee row, so on the user-scoped client this returns null for
  // trainers and the feature's primary users could never build a session.
  // Safe because verifyAdminOrTrainer() gated above — same pattern as the
  // workouts feature actions.
  const adminClient = createAdminClient();
  const { data: trainee, error: traineeError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", traineeId)
    .eq("role", "trainee")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (traineeError) {
    console.error("Verify session trainee error:", traineeError);
    return { error: "שגיאה באימות המתאמן" };
  }
  if (!trainee) return { error: "המתאמן אינו קיים או אינו פעיל" };

  const builderName = profile!.full_name ?? "מאמן";

  const findExisting = () =>
    typedFrom(supabase, "training_sessions")
      .select("id")
      .eq("trainee_id", traineeId)
      .eq("session_date", sessionDate)
      .maybeSingle();

  const { data: found, error: existingError } = await findExisting();
  if (existingError) {
    console.error("Find existing session error:", existingError);
    return { error: "שגיאה בשמירת האימון" };
  }

  let existing = found as { id: string } | null;
  let createdId: string | null = null;

  if (!existing) {
    const { data: created, error } = await typedFrom(supabase, "training_sessions")
      .insert({
        trainee_id: traineeId,
        session_date: sessionDate,
        slot_id: slotId,
        built_by: user!.id,
        built_by_name: builderName,
        notes_he: notes,
      })
      .select("id")
      .single();

    if (error) {
      // Lost the check-then-insert race on UNIQUE(trainee_id, session_date):
      // another trainer created the session between our check and insert.
      // Fall through to the update path instead of failing their form.
      if ((error as { code?: string }).code === "23505") {
        const { data: raced } = await findExisting();
        if (!raced) {
          console.error("Session unique race but no row found:", error);
          return { error: "שגיאה ביצירת האימון" };
        }
        existing = raced as { id: string };
      } else {
        console.error("Create session error:", error);
        return { error: "שגיאה ביצירת האימון" };
      }
    } else if (created) {
      createdId = created.id;
    }
  }

  const sessionId = createdId ?? existing!.id;

  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };

  const { error: rpcError } = await rpcClient.rpc("replace_session_exercises", {
    p_session_id: sessionId,
    p_exercises: exercises.map((exercise, index) => ({
      exercise_id: exercise.exerciseId,
      order_index: index,
      target_sets: exercise.targetSets,
      target_reps_he: exercise.targetReps,
      target_load_he: exercise.targetLoad,
      notes_he: exercise.notes,
    })),
  });

  if (rpcError) {
    console.error("replace_session_exercises failed:", rpcError);
    // A brand-new session left without exercises would show as built with
    // "(0)" on the schedule — worse than no session at all.
    if (createdId) {
      const { error: cleanupError } = await typedFrom(supabase, "training_sessions")
        .delete()
        .eq("id", createdId);
      if (cleanupError) {
        console.error(
          "Failed to clean up exercise-less session:",
          createdId,
          cleanupError,
        );
      }
    }
    return { error: "שגיאה בשמירת התרגילים" };
  }

  // Metadata AFTER the exercises for existing sessions, so built_by only ever
  // credits a builder whose exercise list actually landed.
  if (!createdId) {
    const { error: metaError } = await typedFrom(supabase, "training_sessions")
      .update({
        slot_id: slotId,
        built_by: user!.id,
        built_by_name: builderName,
        notes_he: notes,
      })
      .eq("id", sessionId);

    if (metaError) {
      console.error("Update session metadata error:", metaError);
      return { error: "שגיאה בעדכון פרטי האימון" };
    }
  }

  revalidateSessions();

  return { success: true, data: { id: sessionId } };
}

/** Deletes a session. Planning data — deletion is allowed for staff. */
export async function deleteSessionAction(sessionId: string): Promise<DeleteResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = sessionIdSchema.safeParse({ sessionId });
  if (!validated.success) return { error: "מזהה אימון לא תקין" };

  const supabase = await createClient();

  const { data: existing } = await typedFrom(supabase, "training_sessions")
    .select("id, completed_at")
    .eq("id", validated.data.sessionId)
    .maybeSingle();

  if (!existing) return { error: "האימון לא נמצא" };

  const session = existing as Pick<TrainingSession, "id" | "completed_at">;
  if (session.completed_at) {
    return { error: "לא ניתן למחוק אימון שהושלם" };
  }

  const { error } = await typedFrom(supabase, "training_sessions")
    .delete()
    .eq("id", validated.data.sessionId);

  if (error) {
    console.error("Delete session error:", error);
    return { error: "שגיאה במחיקת האימון" };
  }

  revalidateSessions();

  return { success: true };
}
