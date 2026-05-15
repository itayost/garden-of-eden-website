import { z } from "zod";

const MAX_NOTES_TEXT = 1000;

/**
 * Zod schema for nutrition measurement form data.
 * Mirrors the CHECK constraints on the nutrition_measurements table.
 * All numeric fields are optional; measurement_date is required.
 */
export const nutritionMeasurementSchema = z.object({
  measurement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),

  age: z.number().int().min(0).max(120).optional().nullable(),

  height_cm: z.number().positive().max(299.9).optional().nullable(),
  height_percentile: z.number().min(0).max(100).optional().nullable(),

  weight_kg: z.number().positive().max(499.99).optional().nullable(),

  bmi: z.number().positive().max(199.99).optional().nullable(),
  bmi_percentile: z.number().min(0).max(100).optional().nullable(),

  body_fat_percentage: z.number().min(0).max(100).optional().nullable(),

  notes: z.string().max(MAX_NOTES_TEXT).optional().nullable(),
});

export type MeasurementFormData = z.infer<typeof nutritionMeasurementSchema>;

export const DEFAULT_MEASUREMENT: MeasurementFormData = {
  measurement_date: new Date().toISOString().split("T")[0],
  age: null,
  height_cm: null,
  height_percentile: null,
  weight_kg: null,
  bmi: null,
  bmi_percentile: null,
  body_fat_percentage: null,
  notes: null,
};
