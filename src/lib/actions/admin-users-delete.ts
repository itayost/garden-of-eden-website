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

    // 5. Soft delete by setting deleted_at
    const { error: deleteError } = await adminClient
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);

    if (deleteError) {
      console.error("Soft delete error:", deleteError);
      return { error: deleteError.message || "שגיאה במחיקת משתמש" };
    }

    // 6. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: "user_deleted",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      metadata: {
        deleted_user_name: targetProfile?.full_name,
      },
    });

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

/**
 * Reset user credentials by generating a magic link
 *
 * - Gets target user info
 * - Generates magic link (for email) or notes OTP approach (for phone)
 * - Logs activity
 *
 * Note: For phone-only users, this generates the link but doesn't send SMS.
 * The admin should coordinate credential delivery separately.
 */
export async function resetUserCredentialsAction(userId: string): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate userId format
  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Get target user info
    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId);

    if (getUserError || !targetUser?.user) {
      return { error: "משתמש לא נמצא" };
    }

    let message: string;

    // 4. Generate credentials based on available contact method
    if (targetUser.user.email) {
      // Generate magic link for email users
      const { error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.user.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard`,
        },
      });

      if (linkError) {
        console.error("Generate link error:", linkError);
        return { error: linkError.message || "שגיאה ביצירת קישור כניסה" };
      }

      message = `קישור כניסה נוצר עבור ${targetUser.user.email}. יש לשלוח את הקישור למשתמש.`;
    } else if (targetUser.user.phone) {
      // For phone-only users, they can use the regular OTP login flow
      // No special action needed - inform admin to tell user to log in normally
      message = `משתמש מבוסס טלפון (${targetUser.user.phone}). המשתמש יכול להתחבר באמצעות קוד SMS רגיל.`;
    } else {
      return { error: "למשתמש אין פרטי התקשרות" };
    }

    // 5. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: "credentials_reset",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      metadata: {
        contact_method: targetUser.user.email ? "email" : "phone",
      },
    });

    // 6. Revalidate
    revalidatePath("/admin/users");

    return { success: true, message };

  } catch (error) {
    console.error("Reset credentials error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה באיפוס פרטי כניסה",
    };
  }
}
