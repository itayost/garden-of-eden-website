import { z } from "zod";

export const drillBaseSchema = z.object({
  name_en: z.string().max(200).optional().nullable(),
  name_he: z.string().max(200).optional().nullable(),
  muscle_he: z.string().max(200).optional().nullable(),
  sets_he: z.string().max(200).optional().nullable(),
  how_he: z.string().max(1000).optional().nullable(),
  why_he: z.string().max(1000).optional().nullable(),
  connect_he: z.string().max(1000).optional().nullable(),
});

export type DrillBaseInput = z.infer<typeof drillBaseSchema>;

export const cardBaseSchema = z.object({
  situation_label_he: z.string().max(300).optional().nullable(),
  subtitle_he: z.string().max(300).optional().nullable(),
  age_min_label: z.string().max(100).optional().nullable(),
  level_label: z.string().max(100).optional().nullable(),
  golden_rule_he: z.string().max(1000).optional().nullable(),
});

export type CardBaseInput = z.infer<typeof cardBaseSchema>;

export const failureStepRowSchema = z.object({
  text_he: z.string().min(1, "נדרש טקסט").max(500),
  is_final: z.boolean().default(false),
});

export type FailureStepRowInput = z.infer<typeof failureStepRowSchema>;

export const failureStepsInputSchema = z.array(failureStepRowSchema);

export const phasePointRowSchema = z.object({
  text_he: z.string().min(1, "נדרש טקסט").max(500),
});

export type PhasePointRowInput = z.infer<typeof phasePointRowSchema>;

export const phaseRowSchema = z.object({
  number: z.number().int().nullable().optional(),
  name_he: z.string().min(1, "נדרש שם שלב").max(200),
  subtitle_he: z.string().max(300).optional().nullable(),
  drill_note_he: z.string().max(500).optional().nullable(),
  points: z.array(phasePointRowSchema).default([]),
});

export type PhaseRowInput = z.infer<typeof phaseRowSchema>;

export const phasesInputSchema = z.array(phaseRowSchema);

export const metricRowSchema = z.object({
  label_he: z.string().min(1, "נדרשת תווית").max(200),
  before_he: z.string().max(300).optional().nullable(),
  target_he: z.string().max(300).optional().nullable(),
});

export type MetricRowInput = z.infer<typeof metricRowSchema>;

export const metricsInputSchema = z.array(metricRowSchema);
