import { z } from "zod";

// Phone format: 972 + 9 digits (no + prefix, matches WhatsApp API)
const leadPhoneRegex = /^972\d{9}$/;

/** Normalize Israeli phone formats to 972xxxxxxxxx. Returns null if unrecognizable. */
export function normalizeLeadPhone(phone: string): string | null {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("05") && clean.length === 10) return "972" + clean.slice(1);
  if (clean.startsWith("5") && clean.length === 9) return "972" + clean;
  if (clean.startsWith("972") && clean.length === 12) return clean;
  return null;
}

const leadStatuses = ["new", "callback", "in_progress", "closed", "disqualified"] as const;
const contactTypes = ["call", "whatsapp", "meeting", "message_sent"] as const;
const contactOutcomes = ["interested", "not_interested", "callback", "no_answer"] as const;

export const leadCreateSchema = z.object({
  phone: z
    .string()
    .transform((v) => normalizeLeadPhone(v) ?? v)
    .pipe(z.string().regex(leadPhoneRegex, "מספר טלפון לא תקין")),
  name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),
  is_from_haifa: z.boolean(),
  status: z.enum(leadStatuses),
  note: z.string().max(2000, "הערה ארוכה מדי").optional().or(z.literal("")),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = z.object({
  id: z.string().uuid("מזהה ליד לא תקין"),
  name: z.string().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי").optional(),
  phone: z.string()
    .transform((v) => normalizeLeadPhone(v) ?? v)
    .pipe(z.string().regex(leadPhoneRegex, "מספר טלפון לא תקין"))
    .optional(),
  is_from_haifa: z.boolean().optional(),
  status: z.enum(leadStatuses).optional(),
  note: z.string().max(2000, "הערה ארוכה מדי").optional().or(z.literal("")),
  payment: z.number().min(0).nullable().optional(),
  months: z.number().int().min(0).nullable().optional(),
  total_payment: z.number().min(0).nullable().optional(),
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const contactLogSchema = z.object({
  lead_id: z.string().uuid("מזהה ליד לא תקין"),
  contact_type: z.enum(contactTypes, { message: "יש לבחור סוג יצירת קשר" }),
  rep: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(2000, "הערות ארוכות מדי").optional().or(z.literal("")),
  outcome: z.enum(contactOutcomes).optional(),
});

export type ContactLogInput = z.infer<typeof contactLogSchema>;

export const leadWebhookSchema = z.object({
  phone: z.string().regex(leadPhoneRegex, "Invalid phone format (expected: 972501234567)"),
  name: z.string().min(1).max(100),
  is_from_haifa: z.boolean().optional().default(false),
  note: z.string().max(2000).optional(),
});
