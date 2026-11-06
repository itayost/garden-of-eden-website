import { z } from "zod";
import { normalizePhoneIL } from "@/lib/validations/common";
import { LEAD_CONTACT_OUTCOMES } from "@/types/leads";

const reportMonthSchema = z.string().regex(/^\d{4}-\d{2}-01$/, "פורמט חודש לא תקין");

/** Any Israeli format in, E.164 out; anything unreadable is refused. */
const phoneSchema = z
  .string()
  .transform((v) => normalizePhoneIL(v) ?? v)
  .pipe(z.string().regex(/^\+972\d{9}$/, "מספר טלפון לא תקין"));

export const callTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lead"), leadId: z.string().uuid("מזהה ליד לא תקין") }),
  z.object({ kind: z.literal("retention"), reportMonth: reportMonthSchema, phone: phoneSchema }),
]);

export const contactNameSchema = z.string().trim().min(1).max(200);

export const retentionCallLogSchema = z.object({
  reportMonth: reportMonthSchema,
  phone: phoneSchema,
  traineeName: contactNameSchema,
  outcome: z.enum(LEAD_CONTACT_OUTCOMES, { message: "יש לבחור תוצאה" }),
  notes: z.string().max(2000, "הערות ארוכות מדי"),
});

export type RetentionCallLogInput = z.input<typeof retentionCallLogSchema>;
