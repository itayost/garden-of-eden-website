"use server";

import { cache } from "react";

import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";

interface SlotFormOptions {
  trainers: TrainerOption[];
  trainees: TrainerOption[];
}

type OptionsResult =
  | { success: true; data: SlotFormOptions }
  | { error: string };

/**
 * The two pick-lists the slot form needs: who can take a slot, and who can be
 * on its roster.
 *
 * Admin client on purpose. The profiles SELECT policies let a trainer read
 * only their own row and active trainer rows, so the shared
 * listTrainersForAssignmentAction / getLinkableTraineesAction return an
 * admin-less trainer list and an empty trainee list under a trainer session —
 * the roster picker would offer no suggestions and every name would be saved
 * as free text with no trainee_id, quietly cutting off the session builder
 * downstream. Same reasoning and the same narrow (id, full_name) projection as
 * the session builder page. Safe because verifyAdminOrTrainer() gates above.
 */
export const getSlotFormOptionsAction = cache(
  async (): Promise<OptionsResult> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };

    const supabase = createAdminClient();

    const [trainersResult, traineesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["trainer", "admin"])
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "trainee")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
    ]);

    if (trainersResult.error || traineesResult.error) {
      console.error(
        "Get slot form options error:",
        trainersResult.error ?? traineesResult.error,
      );
      return { error: "שגיאה בטעינת רשימות המאמנים והמתאמנים" };
    }

    return {
      success: true,
      data: {
        trainers: (trainersResult.data as TrainerOption[]) ?? [],
        trainees: (traineesResult.data as TrainerOption[]) ?? [],
      },
    };
  },
);
