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

type CreateResult =
  | { success: true; data: NutritionMeasurementRow }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create a new nutrition measurement entry for a trainee.
 * Restricted to admin and trainer roles.
 */
export async function createMeasurement(
  userId: string,
  input: MeasurementFormData
): Promise<CreateResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  const parsed = nutritionMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  const { data: row, error } = (await typedFrom(supabase, "nutrition_measurements")
    .insert({
      user_id: userId,
      created_by: user!.id,
      ...parsed.data,
    })
    .select()
    .single()) as { data: NutritionMeasurementRow | null; error: Error | null };

  if (error || !row) {
    console.error("Create measurement error:", error);
    return { error: "שגיאה ביצירת מדידה" };
  }

  // Activity log (admin client bypasses RLS — matches admin-assessments pattern).
  try {
    const adminClient = createAdminClient();
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: "measurement_created",
      actor_id: user!.id,
      metadata: { measurement_id: row.id },
    });
  } catch (logError) {
    console.error("Activity log insert failed (non-fatal):", logError);
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true, data: row };
}
