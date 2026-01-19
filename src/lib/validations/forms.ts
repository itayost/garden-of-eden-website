import { z } from "zod";

// Validation helper for optional numeric strings
const optionalNumericString = z.string().optional().refine(
  (val) => !val || val === "" || !isNaN(parseFloat(val)),
  { message: "נא להזין מספר תקין" }
);

// Validation helper for required numeric strings
const requiredNumericString = (errorMsg: string) =>
  z.string().min(1, errorMsg).refine(
    (val) => !isNaN(parseFloat(val)),
    { message: "נא להזין מספר תקין" }
  );

export const preWorkoutSchema = z.object({
  group_training: z.string().optional(),
  urine_color: z.string().optional(),
  nutrition_status: z.string().optional(),
  last_game: z.string().optional(),
  improvements_desired: z.string().optional(),
  sleep_hours: z.string().optional(),
  recent_injury: z.string().optional(),
  next_match: z.string().optional(),
});

export const postWorkoutSchema = z.object({
  training_date: z.string().min(1, "נא לבחור תאריך"),
  trainer_id: z.string().optional(),
  difficulty_level: z.number().min(1).max(10),
  satisfaction_level: z.number().min(1).max(10),
  comments: z.string().optional(),
  contact_info: z.string().optional(),
});

export const nutritionSchema = z.object({
  years_competitive: z.string().optional(),
  previous_counseling: z.boolean(),
  counseling_details: z.string().optional(),
  weight: optionalNumericString,
  height: optionalNumericString,
  allergies: z.boolean(),
  allergies_details: z.string().optional(),
  chronic_conditions: z.boolean(),
  conditions_details: z.string().optional(),
  medications: z.string().optional(),
  medications_list: z.string().optional(),
  bloating_frequency: optionalNumericString,
  stomach_pain: optionalNumericString,
  bowel_frequency: optionalNumericString,
  stool_consistency: z.string().optional(),
  overuse_injuries: z.string().optional(),
  illness_interruptions: optionalNumericString,
  max_days_missed: optionalNumericString,
  fatigue_level: optionalNumericString,
  concentration: optionalNumericString,
  energy_level: optionalNumericString,
  muscle_soreness: optionalNumericString,
  physical_exhaustion: optionalNumericString,
  preparedness: optionalNumericString,
  overall_energy: optionalNumericString,
  additional_comments: z.string().optional(),
});

export type PreWorkoutFormData = z.infer<typeof preWorkoutSchema>;
export type PostWorkoutFormData = z.infer<typeof postWorkoutSchema>;
export type NutritionFormData = z.infer<typeof nutritionSchema>;

// Aliases for backward compatibility (same types now, no transforms)
export type PreWorkoutFormInput = PreWorkoutFormData;
export type PostWorkoutFormInput = PostWorkoutFormData;
export type NutritionFormInput = NutritionFormData;

// Helper to convert form data to database format (strings to numbers)
export function convertFormNumbers<T extends Record<string, unknown>>(
  data: T,
  numericFields: string[]
): T {
  const result = { ...data };
  for (const field of numericFields) {
    if (field in result) {
      const value = result[field] as string;
      if (value === "" || value === undefined || value === null) {
        (result as Record<string, unknown>)[field] = null;
      } else {
        const num = parseFloat(value);
        (result as Record<string, unknown>)[field] = isNaN(num) ? null : num;
      }
    }
  }
  return result;
}
