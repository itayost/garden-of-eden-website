import { z } from "zod";

// Max lengths for string inputs
const MAX_SELECT_LENGTH = 50;
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 500;
const MAX_LONG_TEXT = 2000;

// Validation helper for optional select values
const optionalSelect = z.string().max(MAX_SELECT_LENGTH).optional();

// Validation helper for optional text fields
const optionalShortText = z.string().max(MAX_SHORT_TEXT).optional();
const optionalMediumText = z.string().max(MAX_MEDIUM_TEXT).optional();
const optionalLongText = z.string().max(MAX_LONG_TEXT).optional();

// Validation helper for optional numeric strings
const optionalNumericString = z.string().max(MAX_SHORT_TEXT).optional().refine(
  (val) => !val || val === "" || !isNaN(parseFloat(val)),
  { message: "נא להזין מספר תקין" }
);

// Validation helper for required numeric strings
const requiredNumericString = (errorMsg: string) =>
  z.string().min(1, errorMsg).max(MAX_SHORT_TEXT).refine(
    (val) => !isNaN(parseFloat(val)),
    { message: "נא להזין מספר תקין" }
  );

export const preWorkoutSchema = z.object({
  group_training: optionalSelect,
  urine_color: optionalSelect,
  nutrition_status: optionalSelect,
  last_game: optionalMediumText,
  improvements_desired: optionalMediumText,
  sleep_hours: optionalSelect,
  recent_injury: optionalMediumText,
  next_match: optionalSelect,
});

export const postWorkoutSchema = z.object({
  training_date: z.string().min(1, "נא לבחור תאריך").max(MAX_SHORT_TEXT),
  trainer_id: z.string().max(MAX_SELECT_LENGTH).optional(),
  difficulty_level: z.number().min(1).max(10),
  satisfaction_level: z.number().min(1).max(10),
  comments: optionalLongText,
  contact_info: optionalShortText,
});

export const nutritionSchema = z.object({
  years_competitive: optionalSelect,
  previous_counseling: z.boolean(),
  counseling_details: optionalMediumText,
  weight: optionalNumericString,
  height: optionalNumericString,
  allergies: z.boolean(),
  allergies_details: optionalMediumText,
  chronic_conditions: z.boolean(),
  conditions_details: optionalMediumText,
  medications: optionalSelect,
  medications_list: optionalMediumText,
  bloating_frequency: optionalNumericString,
  stomach_pain: optionalNumericString,
  bowel_frequency: optionalNumericString,
  stool_consistency: optionalSelect,
  overuse_injuries: optionalMediumText,
  illness_interruptions: optionalNumericString,
  max_days_missed: optionalNumericString,
  fatigue_level: optionalNumericString,
  concentration: optionalNumericString,
  energy_level: optionalNumericString,
  muscle_soreness: optionalNumericString,
  physical_exhaustion: optionalNumericString,
  preparedness: optionalNumericString,
  overall_energy: optionalNumericString,
  additional_comments: optionalLongText,
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
