import { z } from "zod";

import { UUID_REGEX } from "@/lib/validations/common";

/** The largest target staff may type: well above any Assessment metric. */
const TARGET_MAX = 9999;
/** The `numeric(10,3)` columns keep 3 decimals. */
const TARGET_DECIMALS = 3;
const REJECT_REASON_MAX = 200;
const VERSION_MAX = 64;

const TARGET_POSITIVE = "היעד חייב להיות מספר חיובי";
const VERSION_INVALID = "גרסה לא תקינה";

const proposalId = z.string({ error: "מזהה הצעה לא תקין" }).regex(UUID_REGEX, "מזהה הצעה לא תקין");

/**
 * The proposal's `updated_at` as the screen showed it, required: an action
 * refuses a proposal that changed since ("ההצעה השתנתה, רעננו את הדף"), so a
 * target staff never saw cannot be accepted, and a request without it is
 * refused outright.
 */
const version = z.string({ error: VERSION_INVALID }).min(1, VERSION_INVALID).max(VERSION_MAX, VERSION_INVALID);

/** At most `decimals` digits after the point, read on the number itself (1e-7 has 7). */
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

const target = z
  .number({ error: TARGET_POSITIVE })
  .refine(Number.isFinite, TARGET_POSITIVE)
  .positive(TARGET_POSITIVE)
  .max(TARGET_MAX, `היעד גדול מדי (מקסימום ${TARGET_MAX})`)
  .refine((value) => hasAtMostDecimals(value, TARGET_DECIMALS), `עד ${TARGET_DECIMALS} ספרות אחרי הנקודה`);

/** קבל, or שנה יעד with the target staff typed; without one the proposal's own target is used. */
export const acceptProposalSchema = z.object({
  proposalId,
  version,
  target: target.optional(),
});

/** דחה, with an optional reason; a blank one is stored as null. */
export const rejectProposalSchema = z.object({
  proposalId,
  version,
  reason: z
    .string()
    .trim()
    .max(REJECT_REASON_MAX, `הסיבה ארוכה מדי (מקסימום ${REJECT_REASON_MAX} תווים)`)
    .nullish()
    .transform((reason) => (reason ? reason : null)),
});

export type AcceptProposalInput = z.input<typeof acceptProposalSchema>;
export type RejectProposalInput = z.input<typeof rejectProposalSchema>;
