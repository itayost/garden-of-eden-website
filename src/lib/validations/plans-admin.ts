import { z } from "zod";
import {
  UUID_REGEX,
  formatPhoneToInternational,
  isValidPhoneIL,
  isValidDateString,
} from "@/lib/validations/common";

const uuid = z.string().regex(UUID_REGEX, "מזהה לא תקין");
const isoDate = z.string().refine(isValidDateString, "תאריך לא תקין");
const phone = z
  .string()
  .trim()
  .refine(isValidPhoneIL, "מספר טלפון לא תקין")
  .transform(formatPhoneToInternational);
const optionalPhone = z
  .string()
  .trim()
  .refine((value) => value === "" || isValidPhoneIL(value), "מספר טלפון לא תקין")
  .transform((v) => (v === "" ? null : formatPhoneToInternational(v)));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

/** What staff may record by hand. Card payments only ever come from the card page. */
export const manualPaymentMethodSchema = z.enum(["cash", "transfer", "bit"]);
export type ManualPaymentMethod = z.infer<typeof manualPaymentMethodSchema>;

const singleLine = /^[^\r\n\t]+$/;

/**
 * A new trainee signed up at the field. Staff type only what the parent
 * cannot fill in later; birthdate, email, health, and consent come from the
 * parent on the signing page.
 */
export const newTraineeSchema = z.object({
  productId: uuid,
  childName: z.string().trim().min(2, "נדרש שם החניך").max(100, "שם ארוך מדי").regex(singleLine, "שם בשורה אחת"),
  /** The child's WhatsApp: the login phone. */
  loginPhone: phone,
  payerPhone: phone,
  parentName: optionalText(100),
  paymentMethod: manualPaymentMethodSchema,
  reference: optionalText(60),
  startsOn: isoDate,
  sendWhatsApp: z.boolean(),
  /** Set after the duplicate prompt; the action refuses a repeat without it. */
  confirmDuplicate: z.boolean().default(false),
});
export type NewTraineeInput = z.input<typeof newTraineeSchema>;

/** A payment for a trainee who already has an account. Chaining decides the start date. */
export const staffPaymentSchema = z.object({
  traineeId: uuid,
  productId: uuid,
  paymentMethod: manualPaymentMethodSchema,
  reference: optionalText(60),
  sendWhatsApp: z.boolean(),
  confirmDuplicate: z.boolean().default(false),
});
export type StaffPaymentInput = z.input<typeof staffPaymentSchema>;

export const issueInvoiceSchema = z.object({ orderId: uuid });
export const resendAgreementSchema = z.object({ agreementId: uuid });

export const extendPlanSchema = z.object({ planId: uuid, endsOn: isoDate });
export const addSessionsSchema = z.object({
  planId: uuid,
  sessions: z.number().int().min(1, "לפחות אימון אחד").max(50, "יותר מדי אימונים"),
});
export const cancelPlanSchema = z.object({ planId: uuid });

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
