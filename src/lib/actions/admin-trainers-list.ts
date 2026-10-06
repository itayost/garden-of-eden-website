"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { loadStaffOptions, type TrainerOption } from "@/lib/staff-options";

export type { TrainerOption } from "@/lib/staff-options";

type ActionResult<T> =
  | { success: true; data: T }
  | { error: string };

/** List staff available for lead assignment. */
export const listTrainersForAssignmentAction = cache(
  async (): Promise<ActionResult<TrainerOption[]>> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };
    const data = await loadStaffOptions(await createClient());
    return data ? { success: true, data } : { error: "שגיאה בטעינת רשימת מאמנים" };
  },
);
