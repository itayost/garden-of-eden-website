import { z } from "zod";

/**
 * Payment validation schemas using Zod 4.x
 * Hebrew error messages for user-facing validation
 */

export const createPaymentSchema = z.object({
  amount: z
    .number({ error: "סכום לא תקין" })
    .positive({ error: "סכום חייב להיות חיובי" }),

  description: z
    .string()
    .min(1, { error: "תיאור נדרש" })
    .max(500, { error: "תיאור ארוך מדי (עד 500 תווים)" }),

  paymentType: z.enum(["one_time", "recurring"], {
    error: "סוג תשלום לא תקין",
  }),

  payerName: z
    .string()
    .min(2, { error: "שם קצר מדי" })
    .max(100, { error: "שם ארוך מדי" })
    .refine(
      (name) => {
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2 && parts.every((p) => p.length >= 2);
      },
      { message: "נא להזין שם מלא (פרטי ומשפחה)" }
    ),

  payerPhone: z
    .string()
    .regex(/^05\d{8}$/, { error: "מספר טלפון לא תקין (דוגמה: 0501234567)" }),

  payerEmail: z
    .string()
    .email({ error: "כתובת אימייל לא תקינה" })
    .optional()
    .or(z.literal("")),

  paymentNum: z
    .number()
    .int({ error: "מספר תשלומים חייב להיות מספר שלם" })
    .positive({ error: "מספר תשלומים חייב להיות חיובי" })
    .optional(),

  maxPaymentNum: z
    .number()
    .int({ error: "מספר תשלומים מקסימלי חייב להיות מספר שלם" })
    .positive({ error: "מספר תשלומים מקסימלי חייב להיות חיובי" })
    .optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Format Zod validation errors into field-level error messages.
 * Returns a record mapping field paths to their first error message.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}
