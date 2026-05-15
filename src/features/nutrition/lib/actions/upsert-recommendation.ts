"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

interface UpsertRecommendationResult {
  success: boolean;
  error?: string;
}

/**
 * Create or update a nutrition recommendation for a trainee.
 * Only trainers and admins can manage recommendations.
 */
export async function upsertRecommendation(
  userId: string,
  recommendationText: string
): Promise<UpsertRecommendationResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { success: false, error: authError };

  if (!isValidUUID(userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

  if (!recommendationText || recommendationText.trim().length < 10) {
    return { success: false, error: "ההמלצה חייבת להכיל לפחות 10 תווים" };
  }

  const supabase = await createClient();

  // Check if recommendation already exists
  const { data: existingRec } = (await supabase
    .from("nutrition_recommendations")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()) as { data: { id: string } | null };

  if (existingRec) {
    const { error } = await supabase
      .from("nutrition_recommendations")
      .update({ recommendation_text: recommendationText })
      .eq("id", existingRec.id);

    if (error) {
      console.error("Error updating recommendation:", error);
      return { success: false, error: "שגיאה בעדכון ההמלצות" };
    }
  } else {
    const { error } = await supabase.from("nutrition_recommendations").insert({
      user_id: userId,
      recommendation_text: recommendationText,
      created_by: user!.id,
    });

    if (error) {
      console.error("Error creating recommendation:", error);
      return { success: false, error: "שגיאה ביצירת ההמלצות" };
    }
  }

  revalidatePath("/dashboard/nutrition");
  revalidatePath(`/admin/nutrition/${userId}`);
  revalidatePath("/admin/nutrition");

  return { success: true };
}
