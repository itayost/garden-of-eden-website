"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { UUID_REGEX } from "@/lib/validations/common";

const MAX_BULK_ASSIGN = 200;

const bulkAssignSchema = z.object({
  userIds: z
    .array(z.string().regex(UUID_REGEX))
    .min(1, "לא נבחרו משתמשים")
    .max(MAX_BULK_ASSIGN, `ניתן לשייך עד ${MAX_BULK_ASSIGN} משתמשים בפעם אחת`),
  branchId: z.string().regex(UUID_REGEX, "מזהה סניף לא תקין"),
});

export type BulkAssignBranchInput = z.input<typeof bulkAssignSchema>;

type Result = { success: true; assigned: number } | { error: string };

/**
 * Adds one branch to every selected user without removing their other
 * branches. Additive on purpose: "move" would silently drop a dual-branch
 * user's second branch, and Eden can untick from the edit form when she
 * really means to remove one.
 */
export async function bulkAssignBranchAction(
  input: BulkAssignBranchInput,
): Promise<Result> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bulkAssignSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }

  const { userIds, branchId } = validated.data;
  const db = createAdminClient();

  const { data: branch } = (await typedFrom(db, "branches")
    .select("id, name_he, is_active")
    .eq("id", branchId)
    .maybeSingle()) as { data: { id: string; name_he: string; is_active: boolean } | null };

  if (!branch || !branch.is_active) return { error: "הסניף לא נמצא או אינו פעיל" };

  const { error: upsertError } = await typedFrom(db, "profile_branches").upsert(
    userIds.map((profileId) => ({ profile_id: profileId, branch_id: branchId })),
    { onConflict: "profile_id,branch_id", ignoreDuplicates: true },
  );

  if (upsertError) {
    console.error("bulkAssignBranch upsert error:", upsertError);
    return { error: "שגיאה בשיוך לסניף" };
  }

  const now = new Date().toISOString();
  const { error: stampError } = await db
    .from("profiles")
    .update({ branches_set_by_admin_at: now })
    .in("id", userIds);

  if (stampError) {
    console.error("bulkAssignBranch stamp error:", stampError);
    return { error: "שגיאה בשיוך לסניף" };
  }

  await db.from("activity_logs").insert(
    userIds.map((userId) => ({
      user_id: userId,
      action: "user_updated",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      changes: [{ field: "branches", old_value: null, new_value: `+ ${branch.name_he}` }],
    })),
  );

  revalidatePath("/admin/users");
  return { success: true, assigned: userIds.length };
}
