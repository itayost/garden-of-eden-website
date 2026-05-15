"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";

type DeleteResult = { success: true } | { error: string };

/**
 * Soft-delete a nutrition measurement entry.
 * Admin only — matches the pattern used by softDeleteAssessmentAction.
 */
export async function softDeleteMeasurement(
  measurementId: string
): Promise<DeleteResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  if (!isValidUUID(measurementId)) {
    return { error: "מזהה מדידה לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    const { data: row, error: fetchError } = (await typedFrom(
      adminClient,
      "nutrition_measurements"
    )
      .select("user_id")
      .eq("id", measurementId)
      .is("deleted_at", null)
      .single()) as { data: { user_id: string } | null; error: Error | null };

    if (fetchError || !row) {
      return { error: "המדידה לא נמצאה" };
    }

    const [{ error: deleteError }] = await Promise.all([
      typedFrom(adminClient, "nutrition_measurements")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user!.id,
        })
        .eq("id", measurementId),
      adminClient.from("activity_logs").insert({
        user_id: row.user_id,
        action: "measurement_deleted",
        actor_id: user!.id,
        actor_name: adminProfile?.full_name || "מנהל",
        metadata: { measurement_id: measurementId },
      }),
    ]);

    if (deleteError) {
      console.error("Soft delete measurement error:", deleteError);
      return { error: "שגיאה במחיקת המדידה" };
    }

    revalidatePath("/dashboard/nutrition");
    revalidatePath(`/admin/nutrition/${row.user_id}`);
    revalidatePath("/admin/nutrition");

    return { success: true };
  } catch (error) {
    console.error("Soft delete measurement error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה במחיקת המדידה",
    };
  }
}
