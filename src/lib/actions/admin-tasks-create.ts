"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { taskCreateSchema, type TaskCreateInput } from "@/lib/validations/tasks";
import type { TrainerTask } from "@/types/tasks";

type ActionResult =
  | { success: true; data: TrainerTask[] }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create one task per selected trainer.
 *
 * A task has exactly one assignee, so assigning the same work to three trainers
 * writes three rows. Each trainer then closes their own and the "task closed"
 * alert stays unambiguous.
 *
 * Only admins may create tasks — this relies on the dedicated `tasks_admin_insert`
 * RLS policy, without which inserting a row for another trainer would fail
 * silently rather than error.
 */
export async function createTasksAction(input: TaskCreateInput): Promise<ActionResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = taskCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { title, description, trainerIds, traineeId, dueDate } = validated.data;
  const supabase = await createClient();

  // Confirm every assignee is real, ACTIVE staff before fanning out. is_active
  // matters as much as deleted_at: offboarding sets is_active = false without
  // soft-deleting, and a task assigned to someone who can no longer log in
  // stays open forever and counts as overdue every day, with nobody able to
  // close it.
  const uniqueTrainerIds = [...new Set(trainerIds)];
  const { data: trainers, error: trainersError } = await supabase
    .from("profiles")
    .select("id")
    .in("id", uniqueTrainerIds)
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null);

  if (trainersError) {
    console.error("Verify task assignees error:", trainersError);
    return { error: "שגיאה באימות המאמנים" };
  }

  if ((trainers?.length ?? 0) !== uniqueTrainerIds.length) {
    return { error: "אחד המאמנים שנבחרו אינו קיים או אינו פעיל" };
  }

  // The linked trainee must actually be a trainee — without the role filter any
  // profile id passes, and a staff member would render under the "מתאמן" column.
  if (traineeId) {
    const { data: trainee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", traineeId)
      .eq("role", "trainee")
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!trainee) return { error: "המתאמן שנבחר אינו קיים או אינו פעיל" };
  }

  const createdByName = adminProfile!.full_name ?? "מנהל";
  const rows = uniqueTrainerIds.map((trainerId) => ({
    title,
    description,
    assigned_to: trainerId,
    trainee_id: traineeId,
    due_date: dueDate,
    status: "open" as const,
    created_by: user!.id,
    created_by_name: createdByName,
  }));

  const { data: created, error } = await typedFrom(supabase, "trainer_tasks")
    .insert(rows)
    .select();

  if (error) {
    console.error("Create tasks error:", error);
    return { error: "שגיאה ביצירת המשימות" };
  }

  // An empty result with no error is the signature of an RLS policy silently
  // rejecting the insert — surface it rather than reporting success.
  if (!created || created.length === 0) {
    console.error("Create tasks returned no rows — check RLS insert policy");
    return { error: "שגיאה ביצירת המשימות" };
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin");

  return { success: true, data: created as TrainerTask[] };
}
