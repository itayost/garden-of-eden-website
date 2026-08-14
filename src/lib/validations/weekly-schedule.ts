import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";
import { EXCEPTION_KINDS } from "@/types/weekly-schedule";

const MAX_TEXT_LENGTH = 300;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const dateSchema = z.string().refine(isValidDateString, "תאריך לא תקין");

/** 0 = Sunday .. 6 = Saturday, matching getIsraelTime().dayOfWeek. */
const weekdaySchema = z
  .number()
  .int("יום בשבוע לא תקין")
  .min(0, "יום בשבוע לא תקין")
  .max(6, "יום בשבוע לא תקין");

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

/** Open-ended bands ("18:00 והלאה") submit an empty end time, stored as NULL. */
const optionalTime = timeSchema
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const bandSchema = z
  .object({
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: optionalTime,
    // Required, unlike a slot's trainer: naming the trainer is the whole
    // content of a band, so an unassigned one would say nothing.
    trainerId: uuidSchema,
    location: optionalText(MAX_TEXT_LENGTH),
    label: optionalText(MAX_TEXT_LENGTH),
    isStandby: z.boolean().default(false),
  })
  // Mirrors the weekly_bands_end_after_start CHECK. A zero-length band would
  // match no hour at all and read as a data-entry slip, not an open-ended one.
  .refine((v) => v.endTime === null || v.endTime > v.startTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  });

export const bandUpdateSchema = z
  .object({
    bandId: uuidSchema,
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: optionalTime,
    trainerId: uuidSchema,
    location: optionalText(MAX_TEXT_LENGTH),
    label: optionalText(MAX_TEXT_LENGTH),
    isStandby: z.boolean().default(false),
  })
  .refine((v) => v.endTime === null || v.endTime > v.startTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  });

export const bandIdSchema = z.object({ bandId: uuidSchema });

/**
 * An Exception is one of two shapes sharing a table, so the cross-field rules
 * carry the weight the column types cannot: 'extra' needs a start time,
 * 'absent' must not carry times at all. Both mirror DB CHECKs.
 */
export const exceptionSchema = z
  .object({
    exceptionDate: dateSchema,
    trainerId: uuidSchema,
    kind: z.enum(EXCEPTION_KINDS),
    startTime: optionalTime,
    endTime: optionalTime,
    location: optionalText(MAX_TEXT_LENGTH),
    label: optionalText(MAX_TEXT_LENGTH),
    note: optionalText(MAX_TEXT_LENGTH),
  })
  .refine((v) => v.kind !== "extra" || v.startTime !== null, {
    message: "נדרשת שעת התחלה",
    path: ["startTime"],
  })
  .refine(
    (v) => v.kind !== "absent" || (v.startTime === null && v.endTime === null),
    { message: "היעדרות חלה על כל היום ואינה נושאת שעות", path: ["startTime"] },
  )
  .refine(
    (v) => v.endTime === null || (v.startTime !== null && v.endTime > v.startTime),
    { message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה", path: ["endTime"] },
  );

export const exceptionIdSchema = z.object({ exceptionId: uuidSchema });

/** The day to build a board for, from the weekly schedule. */
export const buildDaySchema = z.object({ date: dateSchema });

export type BandInput = z.input<typeof bandSchema>;
export type BandUpdateInput = z.input<typeof bandUpdateSchema>;
export type ExceptionInput = z.input<typeof exceptionSchema>;
export type BuildDayInput = z.input<typeof buildDaySchema>;
