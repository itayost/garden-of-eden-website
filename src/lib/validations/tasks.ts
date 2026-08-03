import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;
const MAX_BRIEF_LENGTH = 5000;
/** Guardrail on the multi-assign fan-out; the academy has a handful of trainers. */
const MAX_TRAINERS_PER_CREATE = 20;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

/** ISO YYYY-MM-DD, validated as a real calendar date rather than just a shape. */
const dateSchema = z
  .string()
  .refine(isValidDateString, "תאריך לא תקין");

/** Trims, then treats an empty string as "no value" so the DB stores NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

/**
 * Creating tasks. One task per selected trainer — the UI multi-selects and this
 * fans out to N rows, so each trainer owns and closes their own.
 */
export const taskCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "נדרשת כותרת למשימה")
    .max(MAX_TITLE_LENGTH, "הכותרת ארוכה מדי"),
  description: optionalText(MAX_TEXT_LENGTH),
  trainerIds: z
    .array(uuidSchema)
    .min(1, "יש לבחור לפחות מאמן אחד")
    .max(MAX_TRAINERS_PER_CREATE, "נבחרו יותר מדי מאמנים"),
  traineeId: uuidSchema.nullish().transform((v) => v ?? null),
  dueDate: dateSchema,
});

/** Admin edit of an existing task. Reassignment is allowed; status is not set here. */
export const taskUpdateSchema = z.object({
  taskId: uuidSchema,
  title: z
    .string()
    .trim()
    .min(1, "נדרשת כותרת למשימה")
    .max(MAX_TITLE_LENGTH, "הכותרת ארוכה מדי"),
  description: optionalText(MAX_TEXT_LENGTH),
  assignedTo: uuidSchema,
  traineeId: uuidSchema.nullish().transform((v) => v ?? null),
  dueDate: dateSchema,
});

/** A trainer closing their own task. The note is optional. */
export const taskCompleteSchema = z.object({
  taskId: uuidSchema,
  completionNote: optionalText(MAX_TEXT_LENGTH),
});

/** An admin reopening a closed task. The reason is optional. */
export const taskReopenSchema = z.object({
  taskId: uuidSchema,
  reopenReason: optionalText(MAX_TEXT_LENGTH),
});

export const taskIdSchema = z.object({ taskId: uuidSchema });

/** The daily brief, upserted on its date. */
export const dailyBriefSchema = z.object({
  briefDate: dateSchema,
  content: z
    .string()
    .trim()
    .min(1, "נדרש תוכן לבריף")
    .max(MAX_BRIEF_LENGTH, "הבריף ארוך מדי"),
});

export type TaskCreateInput = z.input<typeof taskCreateSchema>;
export type TaskUpdateInput = z.input<typeof taskUpdateSchema>;
export type TaskCompleteInput = z.input<typeof taskCompleteSchema>;
export type TaskReopenInput = z.input<typeof taskReopenSchema>;
export type DailyBriefInput = z.input<typeof dailyBriefSchema>;
