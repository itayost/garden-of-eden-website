"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

interface UpsertMealPlanPdfResult {
  success: boolean;
  error?: string;
}

/**
 * Create or update a meal plan PDF for a trainee.
 * Only trainers and admins can manage meal plans.
 */
export async function upsertMealPlanPdf(
  userId: string,
  pdfUrl: string,
  pdfPath: string
): Promise<UpsertMealPlanPdfResult> {
  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
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

  // Check if plan already exists
  const { data: existingPlan } = (await supabase
    .from("trainee_meal_plans")
    .select("id, pdf_path")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: { id: string; pdf_path: string | null } | null };

  if (existingPlan) {
    // Delete old PDF from storage if exists
    if (existingPlan.pdf_path) {
      const { error: deleteError } = await supabase.storage
        .from("avatars")
        .remove([existingPlan.pdf_path]);
      if (deleteError) {
        console.error("Failed to delete old PDF from storage:", deleteError);
      }
    }

    const { error } = await supabase
      .from("trainee_meal_plans")
      .update({
        pdf_url: pdfUrl,
        pdf_path: pdfPath,
        meal_plan: null,
      })
      .eq("id", existingPlan.id);

    if (error) {
      console.error("Error updating meal plan PDF:", error);
      return { success: false, error: "שגיאה בעדכון תוכנית התזונה" };
    }
  } else {
    const { error } = await supabase.from("trainee_meal_plans").insert({
      user_id: userId,
      pdf_url: pdfUrl,
      pdf_path: pdfPath,
      meal_plan: null,
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
