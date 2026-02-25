"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

type ActionResult =
  | { success: true; userId?: string; message?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Soft delete a user by setting deleted_at timestamp
 *
 * - Prevents self-deletion
 * - Sets deleted_at instead of hard delete
 * - Logs activity
 */
export async function softDeleteUserAction(userId: string): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate userId format
  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  // 3. Prevent self-deletion
  if (userId === user!.id) {
    return { error: "לא ניתן למחוק את החשבון שלך" };
  }

  const adminClient = createAdminClient();

  try {
    // 4. Get user info for logging
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    // 5. Soft delete and log activity in parallel
    const [{ error: deleteError }] = await Promise.all([
      adminClient
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", userId),
      adminClient.from("activity_logs").insert({
        user_id: userId,
        action: "user_deleted",
        actor_id: user!.id,
        actor_name: adminProfile?.full_name || "מנהל",
        metadata: {
          deleted_user_name: targetProfile?.full_name,
        },
      }),
    ]);

    if (deleteError) {
      console.error("Soft delete error:", deleteError);
      return { error: deleteError.message || "שגיאה במחיקת משתמש" };
    }

    // 7. Revalidate users list
    revalidatePath("/admin/users");

    return { success: true };

  } catch (error) {
    console.error("Soft delete user error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה במחיקת משתמש",
    };
  }
}

