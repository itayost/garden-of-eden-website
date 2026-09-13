import { z } from "zod";
import {
  UUID_REGEX,
  formatPhoneToInternational,
  isValidPhoneIL,
} from "@/lib/validations/common";
import { isValidIsraeliId } from "@/lib/validations/israeli-id";

export const phoneField = z
  .string()
  .trim()
  .min(1, "נדרש מספר טלפון")
  .refine(isValidPhoneIL, "מספר טלפון לא תקין (פורמט: 0501234567)")
  .transform(formatPhoneToInternational);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

export const SINGLE_LINE = /^[^\r\n\t]+$/;

/** Empty becomes null; anything else must be an address. */
export const emailOrEmpty = z
  .string()
  .trim()
  .email('כתובת דוא"ל לא תקינה')
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

/** A trainee's birthdate: a real date and an age between 4 and 25. */
export const childBirthdateField = z
  .string()
  .refine((date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 4 && age <= 25;
  }, "תאריך לידה לא תקין (גיל 4-25)");

export const mustBeTrue = (message: string) =>
  z.boolean().refine((v) => v === true, { message });

/**
 * The enrollment agreement as a form. Mirrors the paper הסכם התקשרות והרשמה
 * block by block; the server action stores the parsed output on the order and
 * on enrollment_agreements.
 */
export const enrollmentSchema = z
  .object({
    productId: z.string().regex(UUID_REGEX, "מסלול לא תקין"),
    renewalToken: z.string().max(200).optional(),

    parentName: z.string().trim().min(2, "נדרש שם ההורה").max(100, "שם ארוך מדי").regex(SINGLE_LINE, "שם בשורה אחת"),
    parentIdNumber: z
      .string()
      .trim()
      .refine(isValidIsraeliId, "מספר תעודת זהות לא תקין"),
    payerPhone: phoneField,
    loginPhone: phoneField,
    email: emailOrEmpty,

    childName: z.string().trim().min(2, "נדרש שם החניך").max(100, "שם ארוך מדי").regex(SINGLE_LINE, "שם בשורה אחת"),
    childBirthdate: childBirthdateField,
    medicalNotes: optionalText(500),

    emergencyContactName: z
      .string()
      .trim()
      .min(2, "נדרש שם איש קשר לחירום")
      .max(100, "שם ארוך מדי")
      .regex(SINGLE_LINE, "שם בשורה אחת"),
    emergencyContactPhone: phoneField,

    declaresHealthy: mustBeTrue("יש לאשר את הצהרת הבריאות"),
    acceptsTerms: mustBeTrue("יש לאשר את קריאת התקנון"),
    authorizesPayment: mustBeTrue("יש לאשר את הסמכת התשלום"),
    photoConsent: z
      .enum(["yes", "no"], { message: "יש לבחור לגבי צילום" })
      .transform((v) => v === "yes"),

    signatureName: z.string().trim().min(2, "נדרשת חתימה").max(100, "שם ארוך מדי").regex(SINGLE_LINE, "שם בשורה אחת"),
  })
  .refine((v) => v.signatureName === v.parentName, {
    message: "החתימה חייבת להיות זהה לשם ההורה",
    path: ["signatureName"],
  });

export type EnrollmentInput = z.input<typeof enrollmentSchema>;
export type EnrollmentData = z.output<typeof enrollmentSchema>;
