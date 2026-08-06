import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

const MAX_TEXT_LENGTH = 300;
const MAX_NAME_LENGTH = 100;
/** Guardrail on roster size; a slot group is a handful of kids. */
const MAX_TRAINEES_PER_SLOT = 40;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const dateSchema = z.string().refine(isValidDateString, "תאריך לא תקין");

/** 24h HH:MM. The DB stores TIME; the form submits HH:MM. */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "שעה לא תקינה");

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
 * A roster entry. traineeId present = linked system account; absent = a
 * free-text name that is not (yet) an account. Both carry the display name.
 */
const rosterEntrySchema = z.object({
  traineeId: uuidSchema.nullish().transform((v) => v ?? null),
  name: z
    .string()
    .trim()
    .min(1, "נדרש שם")
    .max(MAX_NAME_LENGTH, "השם ארוך מדי"),
});

export const slotSchema = z.object({
  scheduleDate: dateSchema,
  startTime: timeSchema,
  trainerId: uuidSchema.nullish().transform((v) => v ?? null),
  focus: optionalText(MAX_TEXT_LENGTH),
  location: optionalText(MAX_TEXT_LENGTH),
  trainees: z
    .array(rosterEntrySchema)
    .min(1, "יש להוסיף לפחות מתאמן אחד")
    .max(MAX_TRAINEES_PER_SLOT, "יותר מדי מתאמנים בסלוט")
    // The dialog dedupes, but a direct server-action call must not put the
    // same linked trainee twice in one slot — Phase 2 sessions would attach
    // twice. A partial unique index enforces the same at the DB layer.
    .refine(
      (entries) => {
        const ids = entries
          .map((entry) => entry.traineeId)
          .filter((id): id is string => id !== null && id !== undefined);
        return new Set(ids).size === ids.length;
      },
      { message: "מתאמן מופיע פעמיים ברשימה" },
    ),
});

export const slotUpdateSchema = slotSchema.extend({
  slotId: uuidSchema,
});

export const slotIdSchema = z.object({ slotId: uuidSchema });

export const duplicateDaySchema = z
  .object({
    fromDate: dateSchema,
    toDate: dateSchema,
  })
  .refine((v) => v.fromDate !== v.toDate, {
    message: "לא ניתן לשכפל יום לעצמו",
    path: ["toDate"],
  });

export type SlotInput = z.input<typeof slotSchema>;
export type SlotUpdateInput = z.input<typeof slotUpdateSchema>;
export type DuplicateDayInput = z.input<typeof duplicateDaySchema>;
