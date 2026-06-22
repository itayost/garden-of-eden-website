import { z } from "zod";
import {
  LEAD_CONTACT_OUTCOMES,
  LEAD_CONTACT_TYPES,
  LEAD_PHONE_REGEX,
  LEAD_SOURCES,
  LEAD_STATUSES,
} from "@/types/leads";
import { leadTabSlugSchema } from "./lead-tabs";

/** Normalize Israeli phone formats to 972xxxxxxxxx. Returns null if unrecognizable. */
export function normalizeLeadPhone(phone: string): string | null {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("05") && clean.length === 10) return "972" + clean.slice(1);
  if (clean.startsWith("5") && clean.length === 9) return "972" + clean;
  if (clean.startsWith("972") && clean.length === 12) return clean;
  return null;
}

/**
 * Parse a birth-year input value from a form field. Returns null for empty,
 * null, undefined, or non-finite values so RHF's setValueAs can be reused
 * across the create and edit forms.
 */
export function parseBirthYearInput(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const phoneSchema = z
  .string()
  .transform((v) => normalizeLeadPhone(v) ?? v)
  .pipe(z.string().regex(LEAD_PHONE_REGEX, "מספר טלפון לא תקין"));

/**
 * Phone variant for editing leads. An empty string clears the number (name-only
 * leads), `undefined` leaves it unchanged, and any other value is normalised and
 * validated like a regular phone.
 */
const phoneUpdateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return v;
    if (v.trim() === "") return null;
    return normalizeLeadPhone(v) ?? v;
  })
  .pipe(
    z.union([
      z.string().regex(LEAD_PHONE_REGEX, "מספר טלפון לא תקין"),
      z.null(),
      z.undefined(),
    ]),
  );

const birthYearSchema = z
  .number()
  .int()
  .min(1990, "שנתון לא תקין")
  .max(2030, "שנתון לא תקין")
  .nullable()
  .optional();

const trainerIdSchema = z
  .string()
  .uuid("מזהה מאמן לא תקין")
  .nullable()
  .optional();

const clubSchema = z.string().max(100, "שם מועדון ארוך מדי").nullable().optional().or(z.literal(""));
const additionalInfoSchema = z
  .string()
  .max(2000, "מידע נוסף ארוך מדי")
  .nullable()
  .optional()
  .or(z.literal(""));

const nameSchema = z
  .string()
  .min(2, "שם חייב להכיל לפחות 2 תווים")
  .max(100, "שם ארוך מדי");

const noteSchema = z.string().max(2000, "הערה ארוכה מדי").optional().or(z.literal(""));

export const leadCreateSchema = z.object({
  phone: phoneSchema,
  name: nameSchema,
  is_from_haifa: z.boolean(),
  status: z.enum(LEAD_STATUSES),
  source: z.enum(LEAD_SOURCES).optional(),
  tab_id: z.string().uuid("מזהה טאב לא תקין").optional(),
  note: noteSchema,
  club: clubSchema,
  birth_year: birthYearSchema,
  additional_info: additionalInfoSchema,
  assigned_trainer_id: trainerIdSchema,
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = z.object({
  id: z.string().uuid("מזהה ליד לא תקין"),
  name: nameSchema.optional(),
  phone: phoneUpdateSchema,
  is_from_haifa: z.boolean().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  tab_id: z.string().uuid("מזהה טאב לא תקין").optional(),
  note: noteSchema,
  payment: z.number().min(0).nullable().optional(),
  months: z.number().int().min(0).nullable().optional(),
  total_payment: z.number().min(0).nullable().optional(),
  club: clubSchema,
  birth_year: birthYearSchema,
  additional_info: additionalInfoSchema,
  assigned_trainer_id: trainerIdSchema,
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

/** A single row from a pasted leads table. phone is already normalized (or null). */
export const bulkLeadRowSchema = z.object({
  name: nameSchema,
  phone: z
    .string()
    .regex(LEAD_PHONE_REGEX, "מספר טלפון לא תקין")
    .nullable(),
  note: z.string().max(2000, "הערה ארוכה מדי").nullable(),
  club: z.string().max(100, "שם מועדון ארוך מדי").nullable(),
  birth_year: birthYearSchema,
  is_from_haifa: z.boolean(),
  additional_info: z.string().max(2000, "מידע נוסף ארוך מדי").nullable(),
});

export type BulkLeadRow = z.infer<typeof bulkLeadRowSchema>;

/** Tab/source/status applied to every row of a bulk paste import. */
export const bulkLeadImportSettingsSchema = z.object({
  tab_id: z.string().uuid("מזהה טאב לא תקין"),
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES),
});

export type BulkLeadImportSettings = z.infer<typeof bulkLeadImportSettingsSchema>;

export const contactLogSchema = z.object({
  lead_id: z.string().uuid("מזהה ליד לא תקין"),
  contact_type: z.enum(LEAD_CONTACT_TYPES, { message: "יש לבחור סוג יצירת קשר" }),
  rep: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(2000, "הערות ארוכות מדי").optional().or(z.literal("")),
  outcome: z.enum(LEAD_CONTACT_OUTCOMES).optional(),
});

export type ContactLogInput = z.infer<typeof contactLogSchema>;

export const leadWebhookSchema = z.object({
  phone: z
    .string()
    .transform((v) => normalizeLeadPhone(v) ?? v)
    .pipe(z.string().regex(LEAD_PHONE_REGEX, "Invalid phone format")),
  name: z.string().min(1).max(100),
  is_from_haifa: z.boolean().optional().default(false),
  note: z.string().max(2000).optional(),
  tab_slug: leadTabSlugSchema.optional(),
  source: z.enum(["paid", "organic"]).optional(),
  club: z.string().max(100).optional(),
  birth_year: z.number().int().min(1990).max(2030).optional(),
  additional_info: z.string().max(2000).optional(),
});
