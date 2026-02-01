"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCreateSchema, type CreateUserInput } from "@/lib/validations/user-create";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult =
  | { success: true; userId?: string; message?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Verify current user is authenticated and has admin role
 */
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, user: null, adminProfile: null };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" as const, user: null, adminProfile: null };
  }

  return { error: null, user, adminProfile };
}

/**
 * Create a new user with phone-based auth
 *
 * - Creates auth user via Supabase Admin API
 * - Profile is auto-created by database trigger
 * - Updates profile with role assignment
 * - Logs activity
 */
export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate input
  const validated = userCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { full_name, phone, role, email } = validated.data;

  // 3. Format phone to +972 format for Supabase
  const formattedPhone = phone.startsWith("+")
    ? phone
    : `+972${phone.slice(1)}`;

  // 4. Create user with admin client
  const adminClient = createAdminClient();

  try {
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      phone: formattedPhone,
      phone_confirm: true, // Auto-confirm since admin is creating
      email: email || undefined,
      email_confirm: !!email,
      user_metadata: { full_name },
    });

    if (createError) {
      // Handle "already registered" error specially
      if (createError.message?.includes("already registered") ||
          createError.message?.includes("already been registered")) {
        return { error: "מספר הטלפון כבר רשום במערכת" };
      }
      console.error("Create user auth error:", createError);
      return { error: createError.message || "שגיאה ביצירת משתמש" };
    }

    if (!authData?.user) {
      return { error: "שגיאה ביצירת משתמש" };
    }

    // 5. Update profile with role (profile auto-created by trigger)
    // Use update, not insert - trigger already created the profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        role,
        phone: formattedPhone,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("Update profile error:", profileError);
      // Profile update failed, but user was created - log but continue
    }

    // 6. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: authData.user.id,
      action: "user_created",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      changes: [
        { field: "role", old_value: null, new_value: role },
        { field: "full_name", old_value: null, new_value: full_name },
      ],
    });

    // 7. Revalidate users list
    revalidatePath("/admin/users");

    return { success: true, userId: authData.user.id };

  } catch (error) {
    console.error("Create user error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה ביצירת משתמש",
    };
  }
}

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
  if (!UUID_REGEX.test(userId)) {
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
  if (!UUID_REGEX.test(userId)) {
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
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
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

      // Log the link (in production, send via email service)
      console.log("Magic link generated for", targetUser.user.email);
      console.log("Link:", linkData?.properties?.action_link);

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
