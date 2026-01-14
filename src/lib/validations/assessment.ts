import { z } from "zod";

// All fields are optional since partial assessments are allowed
export const assessmentSchema = z.object({
  // Assessment date
  assessment_date: z.string().optional(),

  // Sprint tests (seconds) - positive numbers
  sprint_5m: z.number().positive().optional().nullable(),
  sprint_10m: z.number().positive().optional().nullable(),
  sprint_20m: z.number().positive().optional().nullable(),

  // Jump tests (cm) - positive numbers
  jump_2leg_distance: z.number().positive().optional().nullable(),
  jump_right_leg: z.number().positive().optional().nullable(),
  jump_left_leg: z.number().positive().optional().nullable(),
  jump_2leg_height: z.number().positive().optional().nullable(),

  // Agility (seconds)
  blaze_spot_time: z.number().positive().optional().nullable(),

  // Flexibility (cm) - positive numbers
  flexibility_ankle: z.number().nonnegative().optional().nullable(),
  flexibility_knee: z.number().nonnegative().optional().nullable(),
  flexibility_hip: z.number().nonnegative().optional().nullable(),

  // Categorical
  coordination: z.enum(["basic", "advanced", "deficient"]).optional().nullable(),
  leg_power_technique: z.enum(["normal", "deficient"]).optional().nullable(),
  body_structure: z.enum(["thin_weak", "good_build", "strong_athletic"]).optional().nullable(),

  // Kick power (percentage 0-100)
  kick_power_kaiser: z.number().min(0).max(100).optional().nullable(),

  // Mental notes (free text)
  concentration_notes: z.string().optional().nullable(),
  decision_making_notes: z.string().optional().nullable(),
  work_ethic_notes: z.string().optional().nullable(),
  recovery_notes: z.string().optional().nullable(),
  nutrition_notes: z.string().optional().nullable(),

  // General notes
  notes: z.string().optional().nullable(),
});

export type AssessmentFormData = z.infer<typeof assessmentSchema>;

// All assessment form field names (for dynamic iteration)
export const ASSESSMENT_FIELDS: (keyof AssessmentFormData)[] = [
  "assessment_date",
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "jump_2leg_height",
  "blaze_spot_time",
  "flexibility_ankle",
  "flexibility_knee",
  "flexibility_hip",
  "coordination",
  "leg_power_technique",
  "body_structure",
  "kick_power_kaiser",
  "concentration_notes",
  "decision_making_notes",
  "work_ethic_notes",
  "recovery_notes",
  "nutrition_notes",
  "notes",
];

// Default empty values for a new assessment
export const DEFAULT_ASSESSMENT: AssessmentFormData = {
  assessment_date: new Date().toISOString().split("T")[0],
  sprint_5m: null,
  sprint_10m: null,
  sprint_20m: null,
  jump_2leg_distance: null,
  jump_right_leg: null,
  jump_left_leg: null,
  jump_2leg_height: null,
  blaze_spot_time: null,
  flexibility_ankle: null,
  flexibility_knee: null,
  flexibility_hip: null,
  coordination: null,
  leg_power_technique: null,
  body_structure: null,
  kick_power_kaiser: null,
  concentration_notes: null,
  decision_making_notes: null,
  work_ethic_notes: null,
  recovery_notes: null,
  nutrition_notes: null,
  notes: null,
};
