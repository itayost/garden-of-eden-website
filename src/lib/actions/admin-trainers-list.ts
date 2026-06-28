"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export interface TrainerOption {
  id: string;
  full_name: string | null;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { error: string };

/**
 * List staff available for lead assignment.
 * Returns active, non-deleted trainer and admin profiles ordered by name.
 */
export const listTrainersForAssignmentAction = cache(
  async (): Promise<ActionResult<TrainerOption[]>> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };

    const supabase = await createClient();
    const { data, error } = await supabase
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
);
