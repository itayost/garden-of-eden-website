"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCreateSchema, type CreateUserInput } from "@/lib/validations/user-create";
import { type CSVUserRow } from "@/lib/validations/user-import";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID, formatPhoneToInternational } from "@/lib/validations/common";

type ActionResult =
  | { success: true; userId?: string; message?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

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
  const formattedPhone = formatPhoneToInternational(phone);

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

/**
 * Bulk import result type
 */
export type BulkImportResult = {
  success: boolean;
  created: number;
  errors: Array<{ row: number; phone: string; error: string }>;
};

/**
 * Bulk create users from CSV import
 *
 * - Processes each row sequentially
 * - Skips rows with errors, continues with valid ones
 * - Returns summary of created users and errors
 */
export async function bulkCreateUsersAction(users: CSVUserRow[]): Promise<BulkImportResult> {
  // 1. Verify admin
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) {
    return {
      success: false,
      created: 0,
      errors: [{ row: 0, phone: "", error: authError }],
    };
  }

  const adminClient = createAdminClient();
  const created: string[] = [];
  const errors: Array<{ row: number; phone: string; error: string }> = [];

  // 2. Process each user
  for (let i = 0; i < users.length; i++) {
    const csvUser = users[i];
    try {
      // Format phone to +972 format
      const formattedPhone = formatPhoneToInternational(csvUser.phone);

      // Create auth user
      const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirm: true,
        email: csvUser.email || undefined,
        email_confirm: !!csvUser.email,
        user_metadata: { full_name: csvUser.name },
      });

      if (createError) {
        errors.push({
          row: i + 1,
          phone: csvUser.phone,
          error: createError.message?.includes("already registered") ||
                 createError.message?.includes("already been registered")
            ? "מספר טלפון כבר רשום"
            : createError.message || "שגיאה ביצירת משתמש",
        });
        continue;
      }

      if (!authData?.user) {
        errors.push({
          row: i + 1,
          phone: csvUser.phone,
          error: "שגיאה ביצירת משתמש",
        });
        continue;
      }

      // Update profile with role
      await adminClient
        .from("profiles")
        .update({
          full_name: csvUser.name,
          role: csvUser.role,
          phone: formattedPhone,
        })
        .eq("id", authData.user.id);

      created.push(authData.user.id);
    } catch (error) {
      errors.push({
        row: i + 1,
        phone: csvUser.phone,
        error: error instanceof Error ? error.message : "שגיאה לא ידועה",
      });
    }
  }

  // 3. Log bulk activity if any users were created
  if (created.length > 0) {
    await adminClient.from("activity_logs").insert({
      user_id: created[0], // First created user
      action: "bulk_users_created",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      changes: [{ field: "count", old_value: null, new_value: created.length.toString() }],
    });
  }

  // 4. Revalidate users list
  revalidatePath("/admin/users");

  return {
    success: errors.length === 0,
    created: created.length,
    errors,
  };
}
