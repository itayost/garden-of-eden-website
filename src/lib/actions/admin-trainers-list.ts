"use server";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export interface TrainerOption {
  id: string;
  full_name: string | null;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { error: string };

/** Active, non-deleted trainers and admins (Branch managers are trainers), by name. */
async function loadStaffOptions(db: SupabaseClient): Promise<ActionResult<TrainerOption[]>> {
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name")
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("List trainers error:", error);
    return { error: "שגיאה בטעינת רשימת מאמנים" };
  }
  return { success: true, data: (data as TrainerOption[]) || [] };
}

/** List staff available for lead assignment. */
export const listTrainersForAssignmentAction = cache(
  async (): Promise<ActionResult<TrainerOption[]>> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };
    return loadStaffOptions(await createClient());
  },
);

/**
 * Who a trainee can name on the post-training report: every active trainer
 * and admin. Any signed-in user; trainees may not read admin profiles under
 * RLS, so the service role reads, and only names and ids leave.
 */
export async function listTrainingStaffAction(): Promise<ActionResult<TrainerOption[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "נדרשת התחברות" };
  return loadStaffOptions(createAdminClient());
}
