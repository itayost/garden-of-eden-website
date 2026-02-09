"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { userCreateSchema, type CreateUserInput } from "@/lib/validations/user-create";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { formatPhoneToInternational } from "@/lib/validations/common";

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
  // 1. Verify admin or trainer
  const { error: authError, user, profile: callerProfile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  // 2. Validate input
  const validated = userCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { full_name, phone, email } = validated.data;
  // Trainers can only create trainees
  const role = callerProfile?.role === "admin" ? validated.data.role : "trainee";

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
        ...(role !== "trainee" && { profile_completed: true }),
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
      actor_name: callerProfile?.full_name || (callerProfile?.role === "admin" ? "מנהל" : "מאמן"),
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
