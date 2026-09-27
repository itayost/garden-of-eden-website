import { z } from "zod";

import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

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

/**
 * A standby hour never projects into the calendar (materializationPlan skips
 * it), so an hour that is also bookable would offer trainees nothing. Owner
 * rule, 2026-09-24: a bookable hour is never standby.
 */
const notBookableAndStandby = {
  check: (v: { isBookable: boolean; isStandby: boolean }) => !(v.isBookable && v.isStandby),
  message: { message: "שעה שפתוחה להרשמה עצמית אינה יכולה להיות חיזוק במידת הצורך", path: ["isStandby"] },
};

export const bandSchema = z
  .object({
    branchId: uuidSchema,
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: optionalTime,
    // Required, unlike a slot's trainer: naming the trainer is the whole
    // content of a band, so an unassigned one would say nothing.
    // At least one, unlike a slot: trainer_id was NOT NULL on a band, so the
    // standing week has never had a stretch nobody takes, and the form's
    // refusal should be a real rule rather than a courtesy.
    trainerIds: z
      .array(uuidSchema)
      .min(1, "יש לבחור לפחות מאמן אחד")
      .max(10, "יותר מדי מאמנים לשעה אחת"),
    location: optionalText(MAX_TEXT_LENGTH),
    label: optionalText(MAX_TEXT_LENGTH),
    isStandby: z.boolean().default(false),
    /** Seats per projected slot, for self-booking. */
    maxTrainees: z.number().int("מספר מקומות לא תקין").min(1, "לפחות מקום אחד").max(40, "עד 40 מקומות").default(8),
    /** Trainees may book this band's slots themselves. */
    isBookable: z.boolean().default(false),
  })
  // Mirrors the weekly_bands_end_after_start CHECK. A zero-length band would
  // match no hour at all and read as a data-entry slip, not an open-ended one.
  .refine((v) => v.endTime === null || v.endTime > v.startTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  })
  .refine(notBookableAndStandby.check, notBookableAndStandby.message);

export const bandUpdateSchema = z
  .object({
    branchId: uuidSchema,
    bandId: uuidSchema,
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: optionalTime,
    // At least one, unlike a slot: trainer_id was NOT NULL on a band, so the
    // standing week has never had a stretch nobody takes, and the form's
    // refusal should be a real rule rather than a courtesy.
    trainerIds: z
      .array(uuidSchema)
      .min(1, "יש לבחור לפחות מאמן אחד")
      .max(10, "יותר מדי מאמנים לשעה אחת"),
    location: optionalText(MAX_TEXT_LENGTH),
    label: optionalText(MAX_TEXT_LENGTH),
    isStandby: z.boolean().default(false),
    /** Seats per projected slot, for self-booking. */
    maxTrainees: z.number().int("מספר מקומות לא תקין").min(1, "לפחות מקום אחד").max(40, "עד 40 מקומות").default(8),
    /** Trainees may book this band's slots themselves. */
    isBookable: z.boolean().default(false),
  })
  .refine((v) => v.endTime === null || v.endTime > v.startTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  })
  .refine(notBookableAndStandby.check, notBookableAndStandby.message);

export const bandIdSchema = z.object({ bandId: uuidSchema });

/**
 * An Exception records one thing only: a trainer absent for a whole date.
 * A one-off extra hour is a slot made in the calendar, where it can take a
 * roster and bookings; the 'extra' kind stays readable for the rows that
 * exist but is no longer written. Strict, so times or a place sent with an
 * absence are refused rather than silently dropped.
 */
export const exceptionSchema = z
  .object({
    branchId: uuidSchema,
    exceptionDate: dateSchema,
    trainerId: uuidSchema,
    kind: z.literal("absent", { message: "חריגה היא היעדרות בלבד; שעה נוספת נוצרת כסלוט ביומן" }),
    note: optionalText(MAX_TEXT_LENGTH),
  })
  .strict();

export const exceptionIdSchema = z.object({ exceptionId: uuidSchema });

/** The day to build a board for, from the weekly schedule. */
export const buildDaySchema = z.object({ branchId: uuidSchema, date: dateSchema });

/** The Sunday of the week to seed. The action derives the six days itself. */
export const buildWeekSchema = z.object({ branchId: uuidSchema, weekStart: dateSchema });

export type BandInput = z.input<typeof bandSchema>;
export type BandUpdateInput = z.input<typeof bandUpdateSchema>;
export type ExceptionInput = z.input<typeof exceptionSchema>;
export type BuildDayInput = z.input<typeof buildDaySchema>;
export type BuildWeekInput = z.input<typeof buildWeekSchema>;
