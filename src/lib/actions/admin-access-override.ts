"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import type { AccessOverride } from "@/lib/access/course-access";

type ActionResult = { success: true } | { error: string };

/**
 * Set or clear an admin override of a trainee's access tier.
 *
 * The Arbox facts behind the derived tier come from a fuzzy profile link, so a
 * wrongly restricted paying customer has to be fixable here rather than by
 * editing Arbox and waiting for the nightly sync. Passing null hands the
 * decision back to the sync.
 */
export async function setAccessOverride(
  userId: string,
  override: AccessOverride
): Promise<ActionResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(userId)) return { error: "מזהה משתמש לא תקין" };
  if (override !== null && override !== "full" && override !== "course_only") {
    return { error: "ערך לא תקין" };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .update({ access_override: override })
    .eq("id", userId)
    .select("id");

  if (error) {
    console.error("setAccessOverride failed:", error);
    return { error: "שמירה נכשלה" };
  }
  if (!data || data.length === 0) {
    return { error: "המשתמש לא נמצא" };
  }

  // Granting or revoking a customer's access to the app is exactly the change
  // support will later need to attribute, so it is logged like every other admin
  // profile mutation. Best-effort: a failed log must not fail the change.
  const { error: logError } = await db.from("activity_logs").insert({
    user_id: userId,
    action: "access_override_changed",
    actor_id: user!.id,
    actor_name: adminProfile?.full_name || "מנהל",
    changes: { access_override: override },
  });
  if (logError) {
    console.error("setAccessOverride activity log failed:", logError.message);
  }

  revalidatePath(`/admin/users/${userId}`);
  // The trainee's own nav and gating read this on their next request.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
