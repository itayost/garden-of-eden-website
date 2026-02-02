"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

type ActionResult = { success: true } | { error: string };

/**
 * Soft delete an assessment by setting deleted_at and deleted_by
 *
 * - Only admins can delete assessments
 * - Sets deleted_at timestamp and deleted_by user ID for audit trail
 * - Logs activity
 */
export async function softDeleteAssessmentAction(assessmentId: string): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate assessmentId format
  if (!isValidUUID(assessmentId)) {
    return { error: "מזהה מבדק לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Get assessment info for logging (user_id for activity log)
    const { data: assessment, error: fetchError } = await adminClient
      .from("player_assessments")
      .select("user_id")
      .eq("id", assessmentId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !assessment) {
      return { error: "מבדק לא נמצא" };
    }

    // 4. Soft delete by setting deleted_at and deleted_by
    const { error: deleteError } = await adminClient
      .from("player_assessments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user!.id,
      })
      .eq("id", assessmentId);

    if (deleteError) {
      console.error("Soft delete assessment error:", deleteError);
      return { error: "שגיאה במחיקת המבדק" };
    }

    // 5. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: assessment.user_id,
      action: "assessment_deleted",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      metadata: {
        assessment_id: assessmentId,
      },
    });

    // 6. Revalidate assessments list
    revalidatePath("/admin/assessments");

    return { success: true };

  } catch (error) {
    console.error("Soft delete assessment error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה במחיקת המבדק",
    };
  }
}
