"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CSVUserRow } from "@/lib/validations/user-import";
import { verifyAdmin } from "@/lib/actions/shared";
import { formatPhoneToInternational } from "@/lib/validations/common";

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

  const MAX_BULK_IMPORT = 100;

  if (users.length > MAX_BULK_IMPORT) {
    return {
      success: false,
      created: 0,
      errors: [{ row: 0, phone: "", error: `ניתן לייבא עד ${MAX_BULK_IMPORT} משתמשים בפעם אחת` }],
    };
  }

  if (users.length === 0) {
    return { success: false, created: 0, errors: [{ row: 0, phone: "", error: "לא נמצאו משתמשים לייבוא" }] };
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
          ...(csvUser.role !== "trainee" && { profile_completed: true }),
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
