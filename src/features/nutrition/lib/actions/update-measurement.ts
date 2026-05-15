"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import {
  nutritionMeasurementSchema,
  type MeasurementFormData,
} from "@/lib/validations/nutrition-measurements";
import type { NutritionMeasurementRow } from "../../types";

type UpdateResult =
  | { success: true; data: NutritionMeasurementRow }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Update an existing nutrition measurement entry.
 * Restricted to admin and trainer roles.
 */
export async function updateMeasurement(
  measurementId: string,
  input: MeasurementFormData
): Promise<UpdateResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(measurementId)) {
    return { error: "מזהה מדידה לא תקין" };
  }

  const parsed = nutritionMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  // Pre-fetch the row so we have user_id for revalidation and confirm it isn't soft-deleted.
  const { data: existing } = (await typedFrom(supabase, "nutrition_measurements")
    .select("user_id")
    .eq("id", measurementId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: { user_id: string } | null };

  if (!existing) {
    return { error: "המדידה לא נמצאה" };
  }

  const { data: row, error } = (await typedFrom(supabase, "nutrition_measurements")
    .update({ ...parsed.data })
    .eq("id", measurementId)
    .select()
    .single()) as { data: NutritionMeasurementRow | null; error: Error | null };

  if (error || !row) {
    console.error("Update measurement error:", error);
    return { error: "שגיאה בעדכון מדידה" };
  }

  try {
    const adminClient = createAdminClient();
    await adminClient.from("activity_logs").insert({
      user_id: existing.user_id,
      action: "measurement_updated",
      actor_id: user!.id,
      metadata: { measurement_id: measurementId },
    });
  } catch (logError) {
    console.error("Activity log insert failed (non-fatal):", logError);
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${existing.user_id}`);
  revalidatePath("/admin/nutrition");

  return { success: true, data: row };
}
