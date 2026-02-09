"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { userEditSchema, type UserEditFormData, getFieldChanges, getActionType } from "@/lib/validations/user-edit";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID, formatPhoneToInternational } from "@/lib/validations/common";

type ActionResult =
  | { success: true; userId?: string; message?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Update an existing user's profile and auth record
 *
 * - Updates auth.users phone via Admin API (creates phone identity)
 * - Updates profile fields
 * - Logs activity
 * - Trainers can only edit trainees
 */
export async function updateUserAction(
  userId: string,
  input: UserEditFormData
): Promise<ActionResult> {
  // 1. Verify admin or trainer
  const { error: authError, user, profile: callerProfile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  // 2. Validate userId
  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  // 3. Validate input
  const validated = userEditSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { full_name, phone, birthdate, role, is_active } = validated.data;
  const adminClient = createAdminClient();

  try {
    // 4. Fetch target user profile for permission checks and change detection
    const { data: targetProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !targetProfile) {
      return { error: "משתמש לא נמצא" };
    }

    // 5. Trainers can only edit trainees, and cannot change role/is_active
    if (callerProfile?.role === "trainer") {
      if (targetProfile.role !== "trainee") {
        return { error: "מאמנים יכולים לערוך רק מתאמנים" };
      }
      if (role !== targetProfile.role || is_active !== targetProfile.is_active) {
        return { error: "מאמנים לא יכולים לשנות תפקיד או סטטוס" };
      }
    }

    // 6. Prevent self-modification of role or is_active
    if (userId === user!.id) {
      if (role !== targetProfile.role || is_active !== targetProfile.is_active) {
        return { error: "לא ניתן לשנות את התפקיד או הסטטוס של עצמך" };
      }
    }

    // 7. Detect changes
    const changes = getFieldChanges(targetProfile, validated.data);
    if (changes.length === 0) {
      return { success: true, message: "לא בוצעו שינויים" };
    }

    // 8. If phone changed, update auth.users via Admin API
    const formattedPhone = phone ? formatPhoneToInternational(phone) : null;
    const phoneChanged = changes.some((c) => c.field === "phone");

    if (phoneChanged && formattedPhone) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        phone: formattedPhone,
        phone_confirm: true,
      });

      if (authUpdateError) {
        if (authUpdateError.message?.includes("already registered") ||
            authUpdateError.message?.includes("already been registered")) {
          return { error: "מספר הטלפון כבר רשום במערכת" };
        }
        console.error("Auth update error:", authUpdateError);
        return { error: authUpdateError.message || "שגיאה בעדכון פרטי ההזדהות" };
      }
    }

    // 9. Update profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        phone: formattedPhone,
        birthdate: birthdate || null,
        role,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
      return { error: profileError.message || "שגיאה בעדכון הפרופיל" };
    }

    // 10. Log activity
    const actionType = getActionType(changes);
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: actionType,
      actor_id: user!.id,
      actor_name: callerProfile?.full_name || (callerProfile?.role === "admin" ? "מנהל" : "מאמן"),
      changes: JSON.parse(JSON.stringify(changes)),
    });

    // 11. Revalidate
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Update user error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה בעדכון המשתמש",
    };
  }
}
