/** Days of the week */
export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/** Meal categories */
export type MealCategory = "breakfast" | "lunch" | "dinner" | "snacks";

/** Sleep hour ranges from pre_workout_forms */
export type SleepRange = "4-6" | "6-8" | "8-11";

/** Meal plan for a single day */
export interface DayMealPlan {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snacks: string[];
}

/** Weekly meal plan structure */
export type WeeklyMealPlan = Record<DayOfWeek, DayMealPlan>;

/** Database row for trainee_meal_plans */
export interface TraineeMealPlanRow {
  id: string;
  user_id: string;
  meal_plan: WeeklyMealPlan | null;
  pdf_url: string | null;
  pdf_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Database row for nutrition_recommendations */
export interface NutritionRecommendationRow {
  id: string;
  user_id: string;
  recommendation_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Sleep data point for chart */
export interface SleepDataPoint {
  month: string;
  monthDisplay: string;
  poor: number;
  moderate: number;
  good: number;
  total: number;
}

/** Return type for nutrition data fetching */
export interface NutritionData {
  mealPlan: TraineeMealPlanRow | null;
  recommendation: NutritionRecommendationRow | null;
  sleepData: SleepDataPoint[];
}
