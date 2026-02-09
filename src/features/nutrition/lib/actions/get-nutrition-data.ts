"use server";

import { verifyUserAccess } from "@/lib/actions/shared/verify-user-access";
import type {
  NutritionData,
  TraineeMealPlanRow,
  NutritionRecommendationRow,
} from "../../types";
import { aggregateSleepDataByMonth } from "../utils/sleep-analytics";

const EMPTY_NUTRITION_DATA: NutritionData = {
  mealPlan: null,
  recommendation: null,
  sleepData: [],
};

/**
 * Get all nutrition data for a user (meal plan, recommendations, sleep analytics).
 * Caller must be the user themselves or an admin/trainer.
 */
export async function getNutritionData(userId: string): Promise<NutritionData> {
  const { authorized, supabase } = await verifyUserAccess(userId);
  if (!authorized) {
    return EMPTY_NUTRITION_DATA;
  }

  const [
    { data: mealPlan },
    { data: recommendation },
    { data: sleepForms },
  ] = await Promise.all([
    supabase
      .from("trainee_meal_plans")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle() as unknown as { data: TraineeMealPlanRow | null },
    supabase
      .from("nutrition_recommendations")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle() as unknown as { data: NutritionRecommendationRow | null },
    supabase
      .from("pre_workout_forms")
      .select("submitted_at, sleep_hours")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: true }) as unknown as {
      data: { submitted_at: string; sleep_hours: string | null }[] | null;
    },
  ]);

  const sleepData = sleepForms ? aggregateSleepDataByMonth(sleepForms) : [];

  return {
    mealPlan,
    recommendation,
    sleepData,
  };
}
