"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  taskCompleteSchema,
  taskIdSchema,
  taskReopenSchema,
  taskUpdateSchema,
  type TaskCompleteInput,
  type TaskReopenInput,
  type TaskUpdateInput,
} from "@/lib/validations/tasks";
import type { TrainerTask } from "@/types/tasks";

type ActionResult =
  | { success: true; data: TrainerTask }
  | { error: string; fieldErrors?: Record<string, string[]> };

type BulkResult = { success: true; count: number } | { error: string };

function revalidateTasks() {
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
}

/**
 * A trainer closes their own task; an admin may also close on their behalf.
 *
 * This action is the real guard on WHICH columns a trainer can write. RLS can
 * restrict rows but not columns, so `tasks_trainer_update_own` would otherwise
 * let a trainer set `admin_seen_at` on their own row and hide the task from
 * the admin's review queue. Only the four completion columns are written here.
 */
export async function completeTaskAction(
  input: TaskCompleteInput,
): Promise<ActionResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = taskCompleteSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { taskId, completionNote } = validated.data;
  const supabase = await createClient();

  const { data: task } = await typedFrom(supabase, "trainer_tasks")
    .select("id, status, assigned_to")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "המשימה לא נמצאה" };

  const isAdmin = profile!.role === "admin";
  if (!isAdmin && task.assigned_to !== user!.id) {
    return { error: "אין הרשאה לסגור משימה של מאמן אחר" };
  }

  if (task.status !== "open") {
    return { error: "ניתן לסגור רק משימה פתוחה" };
  }

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({
      status: "done",
      completion_note: completionNote,
      completed_at: new Date().toISOString(),
      completed_by: user!.id,
      // Reset so a re-closed task returns to the admin's review queue.
      admin_seen_at: null,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Complete task error:", error);
    return { error: "שגיאה בסגירת המשימה" };
  }

  revalidateTasks();

  return { success: true, data: updated as TrainerTask };
}

/**
 * An admin reopens a closed task because the work was not actually done.
 *
 * `completion_note` is deliberately kept: on a reopened task it is the note
 * from the previous closure attempt, which is the context the trainer needs.
 * It is overwritten when the task is closed again — full cycle history is not
 * retained, by design.
 */
export async function reopenTaskAction(input: TaskReopenInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = taskReopenSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { taskId, reopenReason } = validated.data;
  const supabase = await createClient();

  const { data: task } = await typedFrom(supabase, "trainer_tasks")
    .select("id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "המשימה לא נמצאה" };
  if (task.status !== "done") return { error: "ניתן לפתוח מחדש רק משימה שנסגרה" };

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({
      status: "open",
      reopen_reason: reopenReason,
      // An open task never carries a completion timestamp.
      completed_at: null,
      completed_by: null,
      admin_seen_at: null,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Reopen task error:", error);
    return { error: "שגיאה בפתיחת המשימה מחדש" };
  }

  revalidateTasks();

  return { success: true, data: updated as TrainerTask };
}

/** An admin cancels a task that is no longer relevant. There is no hard delete. */
export async function cancelTaskAction(taskId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = taskIdSchema.safeParse({ taskId });
  if (!validated.success) return { error: "מזהה משימה לא תקין" };

  const supabase = await createClient();

  const { data: task } = await typedFrom(supabase, "trainer_tasks")
    .select("id, status")
    .eq("id", validated.data.taskId)
    .maybeSingle();

  if (!task) return { error: "המשימה לא נמצאה" };
  if (task.status === "cancelled") return { error: "המשימה כבר בוטלה" };

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", validated.data.taskId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Cancel task error:", error);
    return { error: "שגיאה בביטול המשימה" };
  }

  revalidateTasks();

  return { success: true, data: updated as TrainerTask };
}

/** An admin edits a task's content, assignee, linked trainee or due date. */
export async function updateTaskAction(input: TaskUpdateInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = taskUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { taskId, title, description, assignedTo, traineeId, dueDate } = validated.data;
  const supabase = await createClient();

  // Pre-check existence: `.update().eq()` on a missing row reports no error and
  // updates nothing, which would surface as a generic save failure instead of
  // "not found" when the task was cancelled in another session.
  const { data: existing } = await typedFrom(supabase, "trainer_tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();

  if (!existing) return { error: "המשימה לא נמצאה" };

  const { data: assignee } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", assignedTo)
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!assignee) return { error: "המאמן שנבחר אינו קיים או אינו פעיל" };

  // Same role check as create — the FK alone accepts any profile.
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

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({
      title,
      description,
      assigned_to: assignedTo,
      trainee_id: traineeId,
      due_date: dueDate,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Update task error:", error);
    return { error: "שגיאה בעדכון המשימה" };
  }

  revalidateTasks();

  return { success: true, data: updated as TrainerTask };
}

/**
 * An admin acknowledges one closed task, removing it from the review queue.
 * Acknowledgement is explicit rather than automatic on page view — the alert
 * exists so the work gets reviewed, not so a counter gets cleared.
 */
export async function acknowledgeTaskAction(taskId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = taskIdSchema.safeParse({ taskId });
  if (!validated.success) return { error: "מזהה משימה לא תקין" };

  const supabase = await createClient();

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({ admin_seen_at: new Date().toISOString() })
    .eq("id", validated.data.taskId)
    .eq("status", "done")
    .select()
    .maybeSingle();

  if (error) {
    console.error("Acknowledge task error:", error);
    return { error: "שגיאה באישור המשימה" };
  }

  // `.update().eq()` on a row that does not match reports no error and updates
  // nothing, so an empty result means the task was reopened or cancelled since
  // the page rendered.
  if (!updated) return { error: "המשימה כבר אינה סגורה" };

  revalidateTasks();

  return { success: true, data: updated as TrainerTask };
}

/** Acknowledges every closed task still awaiting review, for busy days. */
export async function acknowledgeAllTasksAction(): Promise<BulkResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const supabase = await createClient();

  const { data: updated, error } = await typedFrom(supabase, "trainer_tasks")
    .update({ admin_seen_at: new Date().toISOString() })
    .eq("status", "done")
    .is("admin_seen_at", null)
    .select("id");

  if (error) {
    console.error("Acknowledge all tasks error:", error);
    return { error: "שגיאה באישור המשימות" };
  }

  revalidateTasks();

  return { success: true, count: updated?.length ?? 0 };
}
