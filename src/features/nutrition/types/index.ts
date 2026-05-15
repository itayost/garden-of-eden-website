/** Sleep hour ranges from pre_workout_forms */
export type SleepRange = "4-6" | "6-8" | "8-11";

/** Database row for trainee_meal_plans (PDF-based; legacy JSONB column unused) */
export interface TraineeMealPlanRow {
  id: string;
  user_id: string;
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

/** Database row for nutrition_measurements */
export interface NutritionMeasurementRow {
  id: string;
  user_id: string;
  measurement_date: string;
  age: number | null;
  height_cm: number | null;
  height_percentile: number | null;
  weight_kg: number | null;
  bmi: number | null;
  bmi_percentile: number | null;
  body_fat_percentage: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

/** Hebrew labels for nutrition measurement fields */
export const MEASUREMENT_LABELS_HE: Record<
  keyof Pick<
    NutritionMeasurementRow,
    | "measurement_date"
    | "age"
    | "height_cm"
    | "height_percentile"
    | "weight_kg"
    | "bmi"
    | "bmi_percentile"
    | "body_fat_percentage"
    | "notes"
  >,
  string
> = {
  measurement_date: "תאריך",
  age: "גיל",
  height_cm: "גובה",
  height_percentile: "אחוזון גובה",
  weight_kg: "משקל",
  bmi: "BMI",
  bmi_percentile: "אחוזון BMI",
  body_fat_percentage: "אחוז שומן",
  notes: "הערות",
};

/** Display units for nutrition measurement fields */
export const MEASUREMENT_UNITS: Partial<Record<keyof NutritionMeasurementRow, string>> = {
  height_cm: 'ס"מ',
  height_percentile: "%",
  weight_kg: 'ק"ג',
  bmi_percentile: "%",
  body_fat_percentage: "%",
};

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
