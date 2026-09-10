import { z } from "zod";
import {
  PHONE_REGEX_IL,
  UUID_REGEX,
  formatPhoneToInternational,
} from "@/lib/validations/common";
import { isValidIsraeliId } from "@/lib/validations/israeli-id";

const phoneField = z
  .string()
  .trim()
  .min(1, "נדרש מספר טלפון")
  .regex(PHONE_REGEX_IL, "מספר טלפון לא תקין (פורמט: 0501234567)")
  .transform(formatPhoneToInternational);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v));

const mustBeTrue = (message: string) =>
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

    parentName: z.string().trim().min(2, "נדרש שם ההורה").max(100, "שם ארוך מדי"),
    parentIdNumber: z
      .string()
      .trim()
      .refine(isValidIsraeliId, "מספר תעודת זהות לא תקין"),
    payerPhone: phoneField,
    loginPhone: phoneField,
    email: z
      .string()
      .trim()
      .email('כתובת דוא"ל לא תקינה')
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v)),

    childName: z.string().trim().min(2, "נדרש שם החניך").max(100, "שם ארוך מדי"),
    childBirthdate: z
      .string()
      .refine((date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;
        const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 4 && age <= 25;
      }, "תאריך לידה לא תקין (גיל 4-25)"),
    medicalNotes: optionalText(500),

    emergencyContactName: z
      .string()
      .trim()
      .min(2, "נדרש שם איש קשר לחירום")
      .max(100, "שם ארוך מדי"),
    emergencyContactPhone: phoneField,

    declaresHealthy: mustBeTrue("יש לאשר את הצהרת הבריאות"),
    acceptsTerms: mustBeTrue("יש לאשר את קריאת התקנון"),
    authorizesPayment: mustBeTrue("יש לאשר את הסמכת התשלום"),
    photoConsent: z
      .enum(["yes", "no"], { message: "יש לבחור לגבי צילום" })
      .transform((v) => v === "yes"),

    signatureName: z.string().trim().min(2, "נדרשת חתימה").max(100, "שם ארוך מדי"),
  })
  .refine((v) => v.signatureName === v.parentName, {
    message: "החתימה חייבת להיות זהה לשם ההורה",
    path: ["signatureName"],
  });

export type EnrollmentInput = z.input<typeof enrollmentSchema>;
export type EnrollmentData = z.output<typeof enrollmentSchema>;
