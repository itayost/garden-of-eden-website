"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import {
  TASK_SELECT_WITH_RELATIONS,
  type TaskCounts,
  type TrainerTask,
} from "@/types/tasks";

type TasksResult =
  | { success: true; data: TrainerTask[]; isAdmin: boolean }
  | { error: string };

type CountsResult = { success: true; data: TaskCounts } | { error: string };

/**
 * Fetch tasks scoped by role: an admin sees every task, a trainer sees only
 * tasks assigned to them. RLS enforces the same rule, so the explicit filter
 * here is for query efficiency and clarity, not for security.
 */
export async function getTasksAction(): Promise<TasksResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const isAdmin = profile!.role === "admin";
  const supabase = await createClient();

  let query = typedFrom(supabase, "trainer_tasks")
    .select(TASK_SELECT_WITH_RELATIONS)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("assigned_to", user!.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Get tasks error:", error);
    return { error: "שגיאה בטעינת המשימות" };
  }

  return { success: true, data: (data ?? []) as TrainerTask[], isAdmin };
}

/**
 * Counts for the nav badge.
 *
 * This runs in the admin layout, so it executes on EVERY page under /admin.
 * Three `head: true` count queries return integers with no row payload and hit
 * the partial indexes from the migration, instead of pulling the whole table
 * across the wire to reduce it in JS.
 */
export async function getTaskCountsAction(): Promise<CountsResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const isAdmin = profile!.role === "admin";
  const supabase = await createClient();
  const today = israelToday();

  const scoped = () => {
    const query = typedFrom(supabase, "trainer_tasks").select("id", {
      count: "exact",
      head: true,
    });
    return isAdmin ? query : query.eq("assigned_to", user!.id);
  };

  const [open, overdue, awaiting] = await Promise.all([
    scoped().eq("status", "open"),
    scoped().eq("status", "open").lt("due_date", today),
    scoped().eq("status", "done").is("admin_seen_at", null),
  ]);

  const firstError = open.error || overdue.error || awaiting.error;
  if (firstError) {
    console.error("Get task counts error:", firstError);
    return { error: "שגיאה בטעינת מוני המשימות" };
  }

  return {
    success: true,
    data: {
      open: open.count ?? 0,
      overdue: overdue.count ?? 0,
      awaitingReview: awaiting.count ?? 0,
    },
  };
}

type OptionsResult = { success: true; data: TrainerOption[] } | { error: string };

/**
 * Trainees that can be linked to a task as context.
 * Linking is a tag only — it grants the trainee no access to the task.
 *
 * Task assignees come from `listTrainersForAssignmentAction` in
 * admin-trainers-list.ts, which already returns exactly the staff set needed.
 */
export async function getLinkableTraineesAction(): Promise<OptionsResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Get linkable trainees error:", error);
    return { error: "שגיאה בטעינת רשימת המתאמנים" };
  }

  return { success: true, data: data ?? [] };
}
