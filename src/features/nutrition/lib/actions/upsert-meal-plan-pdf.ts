"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import type { MealPlanType, TraineeMealPlanRow } from "../../types";
import {
  MEAL_PLAN_SLOT_COLUMNS,
  MEAL_PLAN_TYPES,
} from "../meal-plan-slots";

interface UpsertMealPlanPdfResult {
  success: boolean;
  error?: string;
}

type ExistingPathRow = Pick<
  TraineeMealPlanRow,
  "id" | "workout_day_pdf_path" | "rest_day_pdf_path"
>;

/**
 * Create or update a meal plan PDF for a trainee.
 * One PDF per plan type (workout day / rest day) per trainee.
 * Only trainers and admins can manage meal plans.
 */
export async function upsertMealPlanPdf(
  userId: string,
  planType: MealPlanType,
  pdfUrl: string,
  pdfPath: string
): Promise<UpsertMealPlanPdfResult> {
  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

  if (!MEAL_PLAN_TYPES.includes(planType)) {
    return { success: false, error: "סוג תפריט לא תקין" };
  }

  if (!pdfUrl || !pdfPath) {
    return { success: false, error: "חסר קישור ל-PDF" };
  }

  const authResult = await verifyAdminOrTrainer();
  if (authResult.error) {
    return { success: false, error: authResult.error };
  }
  const { user } = authResult;

  const supabase = await createClient();
  const { url: urlCol, path: pathCol } = MEAL_PLAN_SLOT_COLUMNS[planType];

  const { data: existingPlan } = (await supabase
    .from("trainee_meal_plans")
    .select("id, workout_day_pdf_path, rest_day_pdf_path")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: ExistingPathRow | null };

  if (existingPlan) {
    // Remove the old PDF for this plan type (if any).
    const oldPath =
      planType === "workout_day"
        ? existingPlan.workout_day_pdf_path
        : existingPlan.rest_day_pdf_path;

    if (oldPath) {
      const { error: deleteError } = await supabase.storage
        .from("avatars")
        .remove([oldPath]);
      if (deleteError) {
        console.error("Failed to delete old PDF from storage:", deleteError);
      }
    }

    const { error } = await typedFrom(supabase, "trainee_meal_plans")
      .update({
        [urlCol]: pdfUrl,
        [pathCol]: pdfPath,
      })
      .eq("id", existingPlan.id);

    if (error) {
      console.error("Error updating meal plan PDF:", error);
      return { success: false, error: "שגיאה בעדכון תוכנית התזונה" };
    }
  } else {
    const { error } = await typedFrom(supabase, "trainee_meal_plans").insert({
      user_id: userId,
      [urlCol]: pdfUrl,
      [pathCol]: pdfPath,
      created_by: user!.id,
    });

    if (error) {
      console.error("Error creating meal plan PDF:", error);
      return { success: false, error: "שגיאה ביצירת תוכנית התזונה" };
    }
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true };
}
