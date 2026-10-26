"use server";

import { cache } from "react";

import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchReadable } from "@/lib/actions/shared/assert-branch";
import { isValidUUID } from "@/lib/validations/common";
import { createAdminClient } from "@/lib/supabase/admin";
import { byFullName, readInChunks } from "@/lib/supabase/in-chunks";
import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";
import { birthYearOf } from "@/lib/schedule/roster-name";
import type { TraineeOption } from "@/types/schedule";

interface SlotFormOptions {
  trainers: TrainerOption[];
  trainees: TraineeOption[];
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
 * gates above and the projection is (id, full_name), plus a trainee's
 * birthdate and A mark so the roster picker can show "יונתן 08 A".
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

    // A branch has more members than one request URL holds: a slice per
    // request, put back in name order.
    const [trainersResult, traineesResult] = await Promise.all([
      readInChunks(memberIds, (slice) =>
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", slice)
          .in("role", ["trainer", "admin"])
          .eq("is_active", true)
          .is("deleted_at", null),
      ),
      readInChunks(memberIds, (slice) =>
        supabase
          .from("profiles")
          .select("id, full_name, birthdate, plays_up")
          .in("id", slice)
          .eq("role", "trainee")
          .eq("is_active", true)
          .is("deleted_at", null),
      ),
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
        trainers: [...trainersResult.data].sort(byFullName) as TrainerOption[],
        trainees: [...traineesResult.data].sort(byFullName).map((t) => ({
          id: t.id,
          full_name: t.full_name,
          birth_year: birthYearOf(t.birthdate),
          plays_up: t.plays_up,
        })),
      },
    };
  },
);
