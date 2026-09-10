import { z } from "zod";
import {
  PHONE_REGEX_IL,
  UUID_REGEX,
  formatPhoneToInternational,
  isValidDateString,
} from "@/lib/validations/common";

const uuid = z.string().regex(UUID_REGEX, "מזהה לא תקין");
const isoDate = z.string().refine(isValidDateString, "תאריך לא תקין");
const phone = z
  .string()
  .trim()
  .regex(PHONE_REGEX_IL, "מספר טלפון לא תקין")
  .transform(formatPhoneToInternational);
const optionalPhone = z
  .string()
  .trim()
  .regex(PHONE_REGEX_IL, "מספר טלפון לא תקין")
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : formatPhoneToInternational(v)));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

export const extendPlanSchema = z.object({ planId: uuid, endsOn: isoDate });
export const addSessionsSchema = z.object({
  planId: uuid,
  sessions: z.number().int().min(1, "לפחות אימון אחד").max(50, "יותר מדי אימונים"),
});
export const cancelPlanSchema = z.object({ planId: uuid });

/**
 * A cash or bank-transfer trainee, entered by Eden. Same fields as the public
 * form minus the declarations, which live on the paper she holds.
 */
export const manualGrantSchema = z.object({
  productId: uuid,
  parentName: z.string().trim().min(2, "נדרש שם ההורה").max(100, "שם ארוך מדי"),
  payerPhone: phone,
  loginPhone: phone,
  childName: z.string().trim().min(2, "נדרש שם החניך").max(100, "שם ארוך מדי"),
  childBirthdate: isoDate,
  email: z
    .string()
    .trim()
    .email('כתובת דוא"ל לא תקינה')
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalPhone,
  medicalNotes: optionalText(500),
  paymentMethod: z.enum(["cash", "transfer", "other"]),
  note: optionalText(200),
  startsOn: isoDate,
});
export type ManualGrantInput = z.input<typeof manualGrantSchema>;

export const productSchema = z.object({
  name_he: z.string().trim().min(1, "נדרש שם").max(80, "שם ארוך מדי"),
  blurb_he: optionalText(200),
  price_ils: z.number().positive("מחיר חייב להיות חיובי").max(100000, "מחיר גבוה מדי"),
  sessions_total: z.number().int().positive("מספר אימונים לא תקין").nullable(),
  duration_days: z.number().int().positive("נדרש משך בימים").max(730, "משך ארוך מדי"),
  once_per_trainee: z.boolean(),
  gift_he: optionalText(200),
  is_active: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

export const healthSchema = z.object({
  traineeId: uuid,
  medicalNotes: optionalText(500),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalPhone,
});
export type HealthInput = z.input<typeof healthSchema>;

export const PAYMENT_METHOD_LABELS_HE = {
  cash: "מזומן",
  transfer: "העברה בנקאית",
  other: "אחר",
} as const;
