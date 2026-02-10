"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

interface DeleteMealPlanPdfResult {
  success: boolean;
  error?: string;
}

/**
 * Delete meal plan (soft delete) and remove PDF from storage.
 * Only trainers and admins can manage meal plans.
 */
export async function deleteMealPlanPdf(
  userId: string
): Promise<DeleteMealPlanPdfResult> {
  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) {
    return { success: false, error: authError };
  }

  const supabase = await createClient();

  // Find existing plan
  const { data: existingPlan } = (await supabase
    .from("trainee_meal_plans")
    .select("id, pdf_path")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: { id: string; pdf_path: string | null } | null };

  if (!existingPlan) {
    return { success: false, error: "לא נמצאה תוכנית תזונה למחיקה" };
  }

  // Remove PDF from storage
  if (existingPlan.pdf_path) {
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([existingPlan.pdf_path]);
    if (deleteError) {
      console.error("Failed to delete PDF from storage:", deleteError);
    }
  }

  // Soft delete
  const { error } = await supabase
    .from("trainee_meal_plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", existingPlan.id);

  if (error) {
    console.error("Error deleting meal plan:", error);
    return { success: false, error: "שגיאה במחיקת תוכנית התזונה" };
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true };
}
