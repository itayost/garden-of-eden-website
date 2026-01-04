import { z } from "zod";

export const preWorkoutSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא"),
  age: z.number().min(5).max(99).optional().or(z.literal("")),
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
  full_name: z.string().min(2, "נא להזין שם מלא"),
  training_date: z.string().min(1, "נא לבחור תאריך"),
  trainer_id: z.string().optional(),
  difficulty_level: z.number().min(1).max(10),
  satisfaction_level: z.number().min(1).max(10),
  comments: z.string().optional(),
  contact_info: z.string().optional(),
});

export const nutritionSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא"),
  age: z.number().min(5, "נא להזין גיל").max(99),
  years_competitive: z.string().optional(),
  previous_counseling: z.boolean().default(false),
  counseling_details: z.string().optional(),
  weight: z.number().positive().optional().or(z.literal("")),
  height: z.number().positive().optional().or(z.literal("")),
  allergies: z.boolean().default(false),
  allergies_details: z.string().optional(),
  chronic_conditions: z.boolean().default(false),
  conditions_details: z.string().optional(),
  medications: z.string().optional(),
  medications_list: z.string().optional(),
  bloating_frequency: z.number().min(1).max(4).optional(),
  stomach_pain: z.number().min(1).max(4).optional(),
  bowel_frequency: z.number().min(1).max(4).optional(),
  stool_consistency: z.string().optional(),
  overuse_injuries: z.string().optional(),
  illness_interruptions: z.number().min(1).max(4).optional(),
  max_days_missed: z.number().min(1).max(4).optional(),
  fatigue_level: z.number().min(1).max(4).optional(),
  concentration: z.number().min(1).max(4).optional(),
  energy_level: z.number().min(1).max(4).optional(),
  muscle_soreness: z.number().min(1).max(4).optional(),
  physical_exhaustion: z.number().min(1).max(4).optional(),
  preparedness: z.number().min(1).max(4).optional(),
  overall_energy: z.number().min(1).max(4).optional(),
  additional_comments: z.string().optional(),
});

export type PreWorkoutFormData = z.infer<typeof preWorkoutSchema>;
export type PostWorkoutFormData = z.infer<typeof postWorkoutSchema>;
export type NutritionFormData = z.infer<typeof nutritionSchema>;
