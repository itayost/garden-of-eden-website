import { daysBetween } from "@/lib/utils/iso-date";

/**
 * The refund the published cancellation policy proposes (content/
 * cancellation-policy.ts), with every step shown so staff can read it and
 * override it with a reason. The system proposes; a person moves the money.
 */

/** The withdrawal window from the day of purchase, inclusive. */
export const WITHDRAWAL_DAYS = 14;
const FEE_RATE = 0.05;
const FEE_CAP_ILS = 100;

export interface RefundInput {
  /** What was actually paid, after any discount. */
  amountPaid: number;
  purchasedOn: string;
  cancelledOn: string;
  /** Sessions on a Card or package; null for a Plan sold by time. */
  sessionsTotal: number | null;
  sessionsUsed: number;
  /** The Plan's own dates in the queue. */
  startsOn: string;
  endsOn: string;
  durationDays: number;
  /** The value of one session in the branch's price list. */
  singleSessionPrice: number;
  /** A defect or a mismatch with what was agreed: no fee. */
  defect: boolean;
}

/** arbox: paid in Arbox, refunded there; nothing is proposed here. */
export type RefundRule = "fourteen_days" | "time" | "sessions" | "arbox";

export interface RefundStep {
  label: string;
  /** Positive adds to the refund, negative takes away. */
  amount: number;
}

export interface RefundProposal {
  rule: RefundRule;
  steps: RefundStep[];
  proposed: number;
}

const agorot = (n: number) => Math.round(n * 100) / 100;

/** 5% of what was paid, or 100 ILS, whichever is lower. */
export function cancellationFee(amountPaid: number): number {
  return agorot(Math.min(amountPaid * FEE_RATE, FEE_CAP_ILS));
}

const feeStep = (input: RefundInput): RefundStep[] =>
  input.defect
    ? [{ label: "דמי ביטול: אין, הביטול נובע מפגם", amount: 0 }]
    : [{ label: "דמי ביטול: 5% או 100 ש\"ח, הנמוך", amount: -cancellationFee(input.amountPaid) }];

const total = (steps: RefundStep[]) => agorot(Math.max(steps.reduce((sum, s) => sum + s.amount, 0), 0));

/**
 * Within 14 days of purchase and before any session: everything paid, minus
 * the fee, unless the rule for its kind gives more. Otherwise a Plan sold by
 * time (Subscription, Term) refunds the days left as a share of what was
 * paid, with no fee; a Card or package refunds what was paid minus the
 * sessions used at the Single-session price, minus the fee. Never below zero.
 */
export function proposeRefund(input: RefundInput): RefundProposal {
  const byKind = input.sessionsTotal === null ? timeRule(input) : sessionsRule(input);
  if (daysBetween(input.purchasedOn, input.cancelledOn) <= WITHDRAWAL_DAYS && input.sessionsUsed === 0) {
    // The withdrawal right is a floor: the parent gets the better of the two.
    const steps = [paidStep(input), ...feeStep(input)];
    const withdrawal: RefundProposal = { rule: "fourteen_days", steps, proposed: total(steps) };
    return withdrawal.proposed >= byKind.proposed ? withdrawal : byKind;
  }
  return byKind;
}

const paidStep = (input: RefundInput): RefundStep => ({ label: "סכום ששולם", amount: input.amountPaid });

/** A Plan sold by time: the days left as a share of what was paid, no fee. */
function timeRule(input: RefundInput): RefundProposal {
  // The cancellation day is the Plan's last; a Plan not started yet has all its days left.
  const daysLeft = Math.min(Math.max(daysBetween(input.cancelledOn, input.endsOn), 0), input.durationDays);
  const used = agorot(input.amountPaid * (1 - daysLeft / input.durationDays));
  const steps = [
    paidStep(input),
    { label: `ימים שנוצלו: ${input.durationDays - daysLeft} מתוך ${input.durationDays}`, amount: -used },
  ];
  return { rule: "time", steps, proposed: total(steps) };
}

/** A Card or package: paid, minus used sessions at the Single-session price, minus the fee. */
function sessionsRule(input: RefundInput): RefundProposal {
  const steps = [
    paidStep(input),
    {
      label: `אימונים שנוצלו: ${input.sessionsUsed} כפול ${input.singleSessionPrice} ש"ח`,
      amount: -agorot(input.sessionsUsed * input.singleSessionPrice),
    },
    ...feeStep(input),
  ];
  return { rule: "sessions", steps, proposed: total(steps) };
}

/**
 * The branch's Single-session price, else the 10-Card's per-session rate,
 * else nothing to go by. fromCardRate tells staff the fallback is in use.
 */
export function resolveSingleSessionPrice(
  branchPrice: number | null,
  tenCardPrice: number | null,
): { price: number; fromCardRate: boolean } | null {
  if (branchPrice !== null) return { price: branchPrice, fromCardRate: false };
  if (tenCardPrice !== null) return { price: agorot(tenCardPrice / 10), fromCardRate: true };
  return null;
}
