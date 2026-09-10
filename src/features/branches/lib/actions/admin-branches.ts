"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import {
  branchSchema,
  reorderBranchesSchema,
  type BranchInput,
} from "@/lib/validations/branch";
import type { Branch } from "@/types/branches";
import { loadAllBranches } from "../memberships";

export type { BranchInput } from "@/lib/validations/branch";

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

export type BranchWithCount = Branch & { memberCount: number };

const UNIQUE_VIOLATION = "23505";

function revalidateBranchSurfaces(): void {
  revalidatePath("/admin/branches");
  revalidatePath("/admin/safety");
  revalidatePath("/admin/users");
}

/** Branches plus how many users each one has, for the CMS page. */
export async function listBranchesWithCountsAction(): Promise<BranchWithCount[]> {
  const { error } = await verifyAdmin();
  if (error) return [];

  const db = createAdminClient();
  const [branches, membershipsResult] = await Promise.all([
    loadAllBranches(db),
    typedFrom(db, "profile_branches").select("branch_id") as Promise<{
      data: { branch_id: string }[] | null;
    }>,
  ]);

  const counts = new Map<string, number>();
  for (const row of membershipsResult.data ?? []) {
    counts.set(row.branch_id, (counts.get(row.branch_id) ?? 0) + 1);
  }

  return branches.map((branch) => ({
    ...branch,
    memberCount: counts.get(branch.id) ?? 0,
  }));
}

export async function createBranchAction(input: BranchInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = branchSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminClient();

  const { data: maxOrder } = (await typedFrom(db, "branches")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { order_index: number } | null };

  const { error } = await typedFrom(db, "branches").insert({
    name_he: validated.data.name_he,
    arbox_location_name: validated.data.arbox_location_name,
    manager_phone: validated.data.manager_phone,
    is_active: validated.data.is_active,
    order_index: (maxOrder?.order_index ?? -1) + 1,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "כבר קיים סניף בשם הזה" };
    console.error("createBranch error:", error);
    return { error: "שגיאה ביצירת סניף" };
  }

  revalidateBranchSurfaces();
  return { success: true };
}

export async function updateBranchAction(
  id: string,
  input: BranchInput,
): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה סניף לא תקין" };

  const validated = branchSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminClient();

  // .update().eq() on a missing row returns no error and updates nothing.
  const { data: existing } = (await typedFrom(db, "branches")
    .select("id")
    .eq("id", id)
    .maybeSingle()) as { data: { id: string } | null };
  if (!existing) return { error: "הסניף לא נמצא" };

  const { error } = await typedFrom(db, "branches")
    .update({
      name_he: validated.data.name_he,
      arbox_location_name: validated.data.arbox_location_name,
      manager_phone: validated.data.manager_phone,
      is_active: validated.data.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "כבר קיים סניף בשם הזה" };
    console.error("updateBranch error:", error);
    return { error: "שגיאה בעדכון סניף" };
  }

  revalidateBranchSurfaces();
  return { success: true };
}

/** Sets order_index from the position of each id in the list. */
export async function reorderBranchesAction(ids: string[]): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = reorderBranchesSchema.safeParse({ ids });
  if (!validated.success) return { error: "רשימת סניפים לא תקינה" };

  const db = createAdminClient();

  for (const [index, id] of validated.data.ids.entries()) {
    const { error } = await typedFrom(db, "branches")
      .update({ order_index: index })
      .eq("id", id);
    if (error) {
      console.error("reorderBranches error:", error);
      return { error: "שגיאה בסידור הסניפים" };
    }
  }

  revalidateBranchSurfaces();
  return { success: true };
}
