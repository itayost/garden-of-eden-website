"use server";

import { cache } from "react";

import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchReadable } from "@/lib/actions/shared/assert-branch";
import { isValidUUID } from "@/lib/validations/common";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";

interface SlotFormOptions {
  trainers: TrainerOption[];
  trainees: TrainerOption[];
}

type OptionsResult =
  | { success: true; data: SlotFormOptions }
  | { error: string };

/**
 * The two pick-lists the slot form needs, limited to one branch: who can take
 * a slot there, and who can be on its roster.
 *
 * Admin client on purpose. The profiles SELECT policies let a trainer read
 * only their own row and active trainer rows, and profile_branches lets them
 * read only their own memberships, so under a trainer session the user client
 * would return an empty trainee list. Safe because verifyAdminOrTrainer()
 * gates above and the projection is (id, full_name).
 */
export const getSlotFormOptionsAction = cache(
  async (branchId: string): Promise<OptionsResult> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };
    if (!isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };
    const scopeCheck = await assertBranchReadable(branchId);
    if (scopeCheck.error) return { error: scopeCheck.error };

    const supabase = createAdminClient();
    const memberIds = await listProfileIdsInBranches(supabase, [branchId]);
    if (memberIds.length === 0) {
      return { success: true, data: { trainers: [], trainees: [] } };
    }

    const [trainersResult, traineesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
        .in("role", ["trainer", "admin"])
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
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
