"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import type { MealPlanType } from "../../types";
import { MEAL_PLAN_SLOT_COLUMNS, MEAL_PLAN_TYPES } from "../meal-plan-slots";

interface DeleteMealPlanPdfResult {
  success: boolean;
  error?: string;
}

type ExistingRow = {
  id: string;
  workout_day_pdf_url: string | null;
  workout_day_pdf_path: string | null;
  rest_day_pdf_url: string | null;
  rest_day_pdf_path: string | null;
};

/**
 * Delete one plan-type PDF for a trainee. Only clears the matching pair
 * of columns and removes the file from storage. The row itself is only
 * soft-deleted if both plan types end up empty.
 *
 * Only trainers and admins can manage meal plans.
 */
export async function deleteMealPlanPdf(
  userId: string,
  planType: MealPlanType
): Promise<DeleteMealPlanPdfResult> {
  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

  if (!MEAL_PLAN_TYPES.includes(planType)) {
    return { success: false, error: "סוג תפריט לא תקין" };
  }

  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) {
    return { success: false, error: authError };
  }

  const supabase = await createClient();

  const { data: existingPlan } = (await supabase
    .from("trainee_meal_plans")
    .select(
      "id, workout_day_pdf_url, workout_day_pdf_path, rest_day_pdf_url, rest_day_pdf_path"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: ExistingRow | null };

  if (!existingPlan) {
    return { success: false, error: "לא נמצאה תוכנית תזונה למחיקה" };
  }

  const pathToRemove =
    planType === "workout_day"
      ? existingPlan.workout_day_pdf_path
      : existingPlan.rest_day_pdf_path;

  if (pathToRemove) {
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([pathToRemove]);
    if (deleteError) {
      console.error("Failed to delete PDF from storage:", deleteError);
    }
  }

  // Clear just this plan-type's columns.
  const { url: urlCol, path: pathCol } = MEAL_PLAN_SLOT_COLUMNS[planType];
  const { error } = await typedFrom(supabase, "trainee_meal_plans")
    .update({ [urlCol]: null, [pathCol]: null })
    .eq("id", existingPlan.id);

  if (error) {
    console.error("Error clearing meal plan column:", error);
    return { success: false, error: "שגיאה במחיקת תוכנית התזונה" };
  }

  // If both plan-type slots are now empty, soft-delete the whole row so
  // the empty-state appears in the UI.
  const otherStillHasPdf =
    planType === "workout_day"
      ? existingPlan.rest_day_pdf_url
      : existingPlan.workout_day_pdf_url;

  if (!otherStillHasPdf) {
    const { error: softDeleteError } = await supabase
      .from("trainee_meal_plans")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", existingPlan.id);
    if (softDeleteError) {
      console.error("Error soft-deleting empty meal plan row:", softDeleteError);
    }
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true };
}
