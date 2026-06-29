import { z } from "zod";

const AGE_GROUPS = ["U10-12", "U13-14", "U15-16", "U17+"] as const;

export const parameterBaseSchema = z.object({
  name_he: z.string().min(1, "נדרש שם פרמטר").max(200, "שם ארוך מדי"),
  number: z.number().int().nullable().optional(),
  subtitle_he: z.string().max(300, "כותרת משנה ארוכה מדי").optional().nullable(),
  age_metric_label: z.string().max(120, "ארוך מדי").optional().nullable(),
  report_text_he: z.string().max(2000, "ארוך מדי").optional().nullable(),
  report_highlight_he: z.string().max(500, "ארוך מדי").optional().nullable(),
  verbal_text_he: z.string().max(2000, "ארוך מדי").optional().nullable(),
  verbal_tip_he: z.string().max(500, "ארוך מדי").optional().nullable(),
  is_all_positions: z.boolean(),
  positions: z.array(z.string()).default([]),
});

export type ParameterBaseInput = z.infer<typeof parameterBaseSchema>;

export const drillRowSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().max(200).optional().nullable(),
  name_he: z.string().max(200).optional().nullable(),
  muscle_he: z.string().max(200).optional().nullable(),
  sets_he: z.string().max(200).optional().nullable(),
  how_he: z.string().max(1000).optional().nullable(),
  why_he: z.string().max(1000).optional().nullable(),
  connect_he: z.string().max(1000).optional().nullable(),
});

export type DrillRowInput = z.infer<typeof drillRowSchema>;

export const drillsInputSchema = z.array(drillRowSchema);

export const ageRowInputSchema = z.object({
  id: z.string().uuid().optional(),
  age_group: z.enum(AGE_GROUPS),
  what_he: z.string().max(500).optional().nullable(),
  metric_value_he: z.string().max(200).optional().nullable(),
  recovery_he: z.string().max(500).optional().nullable(),
});

export type AgeRowInput = z.infer<typeof ageRowInputSchema>;

export const ageRowsInputSchema = z.array(ageRowInputSchema);
