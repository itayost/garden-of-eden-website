import { z } from "zod";
import {
  UUID_REGEX,
  formatPhoneToInternational,
  isValidPhoneIL,
  isValidDateString,
} from "@/lib/validations/common";
import { MAX_CARD_BALANCE } from "@/lib/plans/adjustment";

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

/** Why staff changed, undid or corrected something: every audit row carries one. */
export const reasonSchema = z.string().trim().min(2, "נדרשת סיבה").max(300, "הסיבה ארוכה מדי");
const reason = reasonSchema;

/**
 * A sale below list price: the amount actually paid and why. The action
 * checks the caller may give it and that it is below the list price.
 */
const discountSchema = z
  .object({
    amountIls: z.number().finite(),
    reason,
  })
  .nullable()
  .default(null);

/**
 * A new trainee signed up at the field. Staff type only what the parent
 * cannot fill in later; birthdate, email, health, and consent come from the
 * parent on the signing page.
 */
/** A manual Card's terms as staff typed them; the action checks them (manualCardProblem). */
const manualCardSchema = z
  .object({
    sessions: z.number().int(),
    priceIls: z.number().finite(),
    days: z.number().int(),
  })
  .nullable()
  .default(null);

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
  discount: discountSchema,
  /** Set after the duplicate prompt; the action refuses a repeat without it. */
  confirmDuplicate: z.boolean().default(false),
});
export type NewTraineeInput = z.input<typeof newTraineeSchema>;

/**
 * A payment for a trainee who already has an account. The Plan queue decides
 * the start; a chosen day (startDateProblem) only when nothing is current or queued.
 */
export const staffPaymentSchema = z.object({
  traineeId: uuid,
  productId: uuid,
  paymentMethod: manualPaymentMethodSchema,
  reference: optionalText(60),
  startsOn: isoDate.nullable().default(null),
  sendWhatsApp: z.boolean(),
  discount: discountSchema,
  manualCard: manualCardSchema,
  confirmDuplicate: z.boolean().default(false),
});
export type StaffPaymentInput = z.input<typeof staffPaymentSchema>;

/** A Payment link: the parent signs and pays by card on their phone. */
export const paymentLinkSchema = z.object({
  traineeId: uuid,
  productId: uuid,
  sendWhatsApp: z.boolean(),
  discount: discountSchema,
  manualCard: manualCardSchema,
});
export type PaymentLinkInput = z.input<typeof paymentLinkSchema>;

/**
 * A plan paid in Arbox. The product pre-fills the terms, but Arbox sold its
 * own, so staff enter the dates, sessions, and amount to match. No receipt
 * and no agreement: Arbox already issued one and holds the signature.
 */
export const arboxPlanSchema = z
  .object({
    traineeId: uuid,
    productId: uuid,
    startsOn: isoDate,
    endsOn: isoDate,
    /** Null for a product without a session count (a subscription or term). */
    sessionsTotal: z.number().int("מספר אימונים לא תקין").min(1, "לפחות אימון אחד").max(200, "יותר מדי אימונים").nullable(),
    amountIls: z.number().positive("הסכום חייב להיות חיובי").max(100000, "סכום גבוה מדי"),
    /** The Arbox membership or receipt number, when staff have it. */
    reference: optionalText(60),
    confirmDuplicate: z.boolean().default(false),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    message: "תאריך הסיום קודם לתאריך ההתחלה",
    path: ["endsOn"],
  });
export type ArboxPlanInput = z.input<typeof arboxPlanSchema>;

export const issueInvoiceSchema = z.object({ orderId: uuid });
export const resendAgreementSchema = z.object({ agreementId: uuid });

/**
 * A new end date goes on the audit trail with a reason; expectedEndsOn is the
 * end the dialog read (the database refuses if it changed).
 */
export const extendPlanSchema = z.object({
  planId: uuid,
  endsOn: isoDate,
  expectedEndsOn: isoDate,
  reason,
});

/**
 * An Adjustment: the balance a Card should show (sessions not yet used), the
 * total the dialog read (the database refuses if it changed), and why.
 */
export const adjustSessionsSchema = z.object({
  planId: uuid,
  target: z.number().int("יתרה היא מספר שלם").min(0, "יתרה לא יכולה להיות שלילית").max(MAX_CARD_BALANCE, "יתרה גבוהה מדי"),
  expectedTotal: z.number().int().min(1),
  reason,
});
export type AdjustSessionsInput = z.input<typeof adjustSessionsSchema>;

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

/** How the money went back. arbox: refunded in Arbox; none: nothing was paid. */
export const refundMethodSchema = z.enum(["card", "cash", "transfer", "bit", "arbox", "none"]);
export type RefundMethod = z.infer<typeof refundMethodSchema>;

/** A Void: the reason is required, and how the money went back is recorded. */
export const voidPlanSchema = z
  .object({
    planId: uuid,
    reason,
    method: refundMethodSchema,
    reference: optionalText(60),
    amountIls: z.number().min(0, "סכום לא תקין").max(100_000, "סכום לא תקין"),
  })
  .refine((v) => v.method !== "none" || v.amountIls === 0, {
    message: "כשלא שולם כסף, סכום ההחזר הוא 0",
    path: ["amountIls"],
  });
export type VoidPlanInput = z.input<typeof voidPlanSchema>;

export const creditNoteSchema = z.object({
  refundId: uuid,
  creditNoteNumber: z.string().trim().min(1, "נדרש מספר מסמך").max(40, "מספר ארוך מדי"),
});

/**
 * A Cancellation: the Plan ends today and the refund follows the policy. An
 * amount other than the proposal needs a reason; the server recomputes the
 * proposal and compares.
 */
export const cancelPlanWithRefundSchema = z
  .object({
    planId: uuid,
    reason,
    defect: z.boolean(),
    method: refundMethodSchema,
    reference: optionalText(60),
    amountIls: z.number().min(0, "סכום לא תקין").max(100_000, "סכום לא תקין"),
    overrideReason: optionalText(300),
  })
  .refine((v) => v.method !== "none" || v.amountIls === 0, {
    message: "כשלא הוחזר כסף, הסכום הוא 0",
    path: ["amountIls"],
  });
export type CancelPlanWithRefundInput = z.input<typeof cancelPlanWithRefundSchema>;

/** An Early end: the Current plan ends today so the next one starts. Reason required. */
export const earlyEndSchema = z.object({
  planId: uuid,
  reason,
});
export type EarlyEndInput = z.input<typeof earlyEndSchema>;

/**
 * A Freeze: medical only, so staff confirm a certificate; open-ended when
 * endsOn is null. The dates are checked against the queue in the action.
 */
export const freezePlanSchema = z.object({
  planId: uuid,
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
  medicalCertificate: z.boolean().refine((v) => v, "הקפאה רק באישור רפואי"),
  reason,
});
export type FreezePlanInput = z.input<typeof freezePlanSchema>;

/** The dates a Freeze preview is worked out on; checked like the Freeze itself. */
export const freezePreviewSchema = freezePlanSchema.pick({ planId: true, startsOn: true, endsOn: true });

/** Ends an open-ended Freeze on a day; its length counts then. */
export const endFreezeSchema = z.object({
  freezeId: uuid,
  endsOn: isoDate,
});
export type EndFreezeInput = z.input<typeof endFreezeSchema>;
