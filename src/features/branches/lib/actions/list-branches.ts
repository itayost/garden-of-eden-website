"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Branch, BranchOption } from "@/types/branches";
import { loadAllBranches, loadBranchOptions } from "../memberships";

/** Every branch, for admin tables that must still name a deactivated one. */
export const listBranchesAction = cache(async (): Promise<Branch[]> => {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];
  return loadAllBranches(createAdminClient());
});

/** Active branches only, for pickers. */
export const listActiveBranchOptionsAction = cache(
  async (): Promise<BranchOption[]> => {
    const { error } = await verifyAdminOrTrainer();
    if (error) return [];
    return loadBranchOptions(createAdminClient());
  },
);
