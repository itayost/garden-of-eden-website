import { z } from "zod";
import { UUID_REGEX } from "@/lib/validations/common";
import { isValidIsraeliId } from "@/lib/validations/israeli-id";
import { cardNumberValid, digitsOnly, expiryValid } from "@/lib/payments/card";

export const MAX_INSTALLMENTS = 3;

/**
 * The card form. Validated on the client for feedback and again in the
 * server action before anything is sent to the acquirer. The parsed output
 * never leaves the action and is never logged.
 */
export const cardPaymentSchema = z
  .object({
    orderId: z.string().regex(UUID_REGEX, "מזהה הזמנה לא תקין"),
    holderName: z.string().trim().min(2, "נדרש שם בעל הכרטיס").max(60, "השם ארוך מדי"),
    holderId: z
      .string()
      .transform((v) => digitsOnly(v))
      .refine((v) => isValidIsraeliId(v), "מספר תעודת זהות לא תקין"),
    cardNumber: z
      .string()
      .transform((v) => digitsOnly(v))
      .refine((v) => cardNumberValid(v), "מספר הכרטיס לא תקין"),
    expMonth: z.coerce.number().int().min(1, "נדרש חודש").max(12, "חודש לא תקין"),
    expYear: z.coerce.number().int().min(0, "נדרשת שנה"),
    cvv: z.string().regex(/^\d{3,4}$/, "3 או 4 ספרות בגב הכרטיס"),
    installments: z.coerce.number().int().min(1).max(MAX_INSTALLMENTS).default(1),
  })
  .refine((v) => expiryValid(v.expMonth, v.expYear), {
    message: "תוקף הכרטיס עבר",
    path: ["expYear"],
  });

export type CardPaymentInput = z.input<typeof cardPaymentSchema>;
export type CardPaymentData = z.output<typeof cardPaymentSchema>;
