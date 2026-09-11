import { z } from "zod";
import { UUID_REGEX } from "@/lib/validations/common";
import { isValidIsraeliId } from "@/lib/validations/israeli-id";
import {
  childBirthdateField,
  emailOrEmpty,
  mustBeTrue,
  optionalText,
  phoneField,
  SINGLE_LINE,
} from "@/lib/validations/enrollment";

const name = (required: string) =>
  z.string().trim().min(2, required).max(100, "שם ארוך מדי").regex(SINGLE_LINE, "שם בשורה אחת");

/**
 * What the parent fills in on the signing page after a staff member took
 * the payment: everything the staff could not know, plus the declarations
 * and the signature. The token is the HMAC from the WhatsApp link.
 */
export const signAgreementSchema = z.object({
  agreementId: z.string().regex(UUID_REGEX, "מזהה לא תקין"),
  token: z.string().regex(/^[0-9a-f]{64}$/, "קישור לא תקין"),
  parentName: name("נדרש שם ההורה"),
  parentIdNumber: z
    .string()
    .trim()
    .refine(isValidIsraeliId, "מספר תעודת זהות לא תקין"),
  parentEmail: emailOrEmpty,
  childBirthdate: childBirthdateField,
  medicalNotes: optionalText(500),
  emergencyContactName: name("נדרש שם איש קשר לחירום"),
  emergencyContactPhone: phoneField,
  declaresHealthy: mustBeTrue("יש לאשר את הצהרת הבריאות"),
  acceptsTerms: mustBeTrue("יש לאשר את התקנון ומדיניות הביטול"),
  authorizesPayment: mustBeTrue("יש לאשר את החיוב"),
  photoConsent: z.enum(["yes", "no"], { message: "יש לבחור לגבי צילום" }).transform((v) => v === "yes"),
  signatureName: name("נדרשת חתימה"),
});

export type SignAgreementInput = z.input<typeof signAgreementSchema>;
export type SignAgreementData = z.output<typeof signAgreementSchema>;
