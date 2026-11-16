/**
 * Whether a sent Weekly report or "התגעגענו" also goes to the parent on
 * WhatsApp, and why not when it does not. Pure: the dates are Israel calendar
 * days, the caller passes them. The player sees the report on the dashboard
 * either way.
 */
import { ADULT_AGE, ageOn } from "@/features/parent-phone/lib/prompt";
import { normalizePhoneIL } from "@/lib/validations/common";

export type SkipReason = "no_template" | "no_phone" | "adult" | "whatsapp_failed";

/** What the queue shows for a parent message that did not go out. */
export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  no_template: "אין תבנית וואטסאפ מאושרת",
  no_phone: "אין טלפון של הורה",
  adult: "מעל גיל 18",
  whatsapp_failed: "השליחה בוואטסאפ נכשלה",
};

export interface ParentDeliveryInput {
  guardianPhone: string | null;
  guardianNotNeeded: boolean;
  birthdate: string | null;
  today: string;
  /** The WhatsApp template name for this kind is set. */
  templateConfigured: boolean;
}

export type ParentDelivery = { send: true; phone: string } | { send: false; reason: SkipReason };

/**
 * A Trainee of 18 or more, or one who said no parent is needed, gets no
 * parent message. An unknown birthdate is not a reason to skip.
 */
export function parentDelivery(input: ParentDeliveryInput): ParentDelivery {
  const adult = input.birthdate !== null && ageOn(input.birthdate, input.today) >= ADULT_AGE;
  if (adult || input.guardianNotNeeded) return { send: false, reason: "adult" };

  const phone = normalizePhoneIL(input.guardianPhone);
  if (phone === null) return { send: false, reason: "no_phone" };

  if (!input.templateConfigured) return { send: false, reason: "no_template" };
  return { send: true, phone };
}

/**
 * The label of a stored `parent_skip_reason`. A failed send is stored as
 * `whatsapp_failed: <error>`, so the code before the colon decides.
 */
export function skipLabel(stored: string | null): string | null {
  if (!stored) return null;
  const code = stored.split(":")[0].trim();
  return Object.hasOwn(SKIP_REASON_LABELS, code) ? SKIP_REASON_LABELS[code as SkipReason] : null;
}
