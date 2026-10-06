"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { proposeRefund, resolveSingleSessionPrice, type RefundProposal } from "@/lib/plans/refund";
import { shrinkImpact } from "@/lib/plans/shrink";
import {
  cancelPlanWithRefundSchema,
  type CancelPlanWithRefundInput,
  type RefundMethod,
} from "@/lib/validations/plans-admin";
import {
  loadPlanContext,
  suggestedRefundMethod,
  toBooking,
  withPlanChange,
  type AffectedBooking,
  type PlanContext,
} from "../plan-context";
import type { StoredPlan } from "../queries";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { undoPlan } from "../undo-plan";

/** The 10-Card's per-session rate is the fallback Single-session price. */
const TEN_CARD_SESSIONS = 10;

export interface CancellationPreview {
  planName: string;
  /** Why it cannot be cancelled; null when it can. */
  refusal: string | null;
  proposal: RefundProposal | null;
  amountPaid: number;
  /** The Single-session price in use is the 10-Card rate: no branch price is set. */
  singlePriceFromCardRate: boolean;
  suggestedMethod: RefundMethod;
  receiptUrl: string | null;
  moved: AffectedBooking[];
  cancelled: AffectedBooking[];
}

const asCancelled = (plans: readonly StoredPlan[], planId: string, today: string) =>
  withPlanChange(plans, planId, { status: "cancelled", endedOn: today });

/** The branch's Single-session price, or the 10-Card rate when none is set. */
async function loadSingleSessionPrice(db: SupabaseClient<Database>, branchId: string) {
  const [{ data: branch }, { data: tenCard }] = await Promise.all([
    db.from("branches").select("single_session_price_ils").eq("id", branchId).maybeSingle(),
    // Slugs are unique across branches; find the branch's own 10-session Card.
    db
      .from("plan_products")
      .select("price_ils")
      .eq("branch_id", branchId)
      .eq("kind", "session_card")
      .eq("sessions_total", TEN_CARD_SESSIONS)
      .order("is_active", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const branchPrice = branch?.single_session_price_ils != null ? Number(branch.single_session_price_ils) : null;
  return resolveSingleSessionPrice(branchPrice, tenCard ? Number(tenCard.price_ils) : null);
}

interface Assessment {
  refusal: string | null;
  proposal: RefundProposal | null;
  amountPaid: number;
  fromCardRate: boolean;
}

/** The policy's proposal for cancelling this Plan today. */
async function assess(db: SupabaseClient<Database>, ctx: PlanContext, today: string, defect: boolean): Promise<Assessment> {
  const amountPaid = ctx.order ? Number(ctx.order.amount_ils) : 0;
  if (ctx.plan.status !== "active") return { refusal: "המסלול כבר בוטל", proposal: null, amountPaid, fromCardRate: false };
  if (ctx.plan.ended_on) return { refusal: "המסלול כבר הסתיים", proposal: null, amountPaid, fromCardRate: false };

  // Paid in Arbox: its dates and sessions live there, and so does the refund.
  if (ctx.order?.payment_method === "arbox") {
    const proposal: RefundProposal = {
      rule: "arbox",
      steps: [{ label: "שולם ב-Arbox: ההחזר, אם יש, מתבצע ב-Arbox", amount: 0 }],
      proposed: 0,
    };
    return { refusal: null, proposal, amountPaid, fromCardRate: false };
  }

  // Only a Card's used sessions are priced; a Plan sold by time never needs
  // it, and neither does one given without charging (nothing to refund).
  const pricesSessions = ctx.plan.sessionsTotal !== null && amountPaid > 0;
  const single = pricesSessions ? await loadSingleSessionPrice(db, ctx.plan.branch_id) : null;
  if (pricesSessions && !single) {
    return { refusal: "לא הוגדר מחיר אימון בודד לסניף, ואין כרטיסיית 10 להשוואה", proposal: null, amountPaid, fromCardRate: false };
  }

  // An Add-on is outside the queue: it keeps its own window and counts no sessions.
  const entry = resolvePlanQueue(ctx.plans, ctx.rows, today).plans.find((e) => e.plan.id === ctx.plan.id);
  const purchasedOn = israelToday(new Date(ctx.order?.paid_at ?? ctx.order?.created_at ?? ctx.plan.created_at));
  const proposal = proposeRefund({
    amountPaid,
    purchasedOn,
    cancelledOn: today,
    sessionsTotal: ctx.plan.sessionsTotal,
    sessionsUsed: entry?.used ?? 0,
    startsOn: entry?.startsOn ?? ctx.plan.starts_on,
    endsOn: entry?.expiresOn ?? ctx.plan.ends_on,
    durationDays: ctx.plan.durationDays,
    singleSessionPrice: single?.price ?? 0,
    defect,
  });
  return { refusal: null, proposal, amountPaid, fromCardRate: single?.fromCardRate ?? false };
}

/** What a Cancellation would do and refund, for the confirmation. Admins and Branch managers of the Plan's branch. */
export async function previewCancellationAction(
  planId: string,
  defect: boolean,
): Promise<CancellationPreview | { error: string }> {
  if (!isValidUUID(planId)) return { error: "מזהה לא תקין" };
  const db = createAdminClient();
  const ctx = await loadPlanContext(db, planId);
  if ("error" in ctx) return ctx;

  const today = israelToday();
  const assessed = await assess(db, ctx, today, defect === true);
  const impact = shrinkImpact(ctx.plans, asCancelled(ctx.plans, planId, today), ctx.rows, today);
  return {
    planName: ctx.plan.product?.name_he ?? "מסלול",
    refusal: assessed.refusal,
    proposal: assessed.proposal,
    amountPaid: assessed.amountPaid,
    singlePriceFromCardRate: assessed.fromCardRate,
    suggestedMethod: suggestedRefundMethod(ctx.order),
    receiptUrl: ctx.order?.morning_document_url ?? null,
    moved: impact.moved.map((m) => toBooking(m.row)),
    cancelled: impact.cancelled.map(toBooking),
  };
}

export type CancellationOutcome =
  | { ok: true; refundId: string; receiptUrl: string | null; cancelledCount: number; movedCount: number }
  | { error: string };

/**
 * A parent's Cancellation: the Plan ends today, sessions used stay used, and
 * the refund follows the policy unless staff override it with a reason. The
 * Plan is claimed, the audit record written and the order marked together
 * (claimAndRecordUndo), then the shrink rule runs. No money moves here.
 */
export async function cancelPlanWithRefundAction(input: CancelPlanWithRefundInput): Promise<CancellationOutcome> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = cancelPlanWithRefundSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const ctx = await loadPlanContext(db, data.planId);
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const assessed = await assess(db, ctx, today, data.defect);
  if (assessed.refusal || !assessed.proposal) return { error: assessed.refusal ?? "לא ניתן לחשב החזר" };
  if (data.amountIls > assessed.amountPaid) return { error: "סכום ההחזר גבוה מהסכום ששולם" };
  const overridden = data.amountIls !== assessed.proposal.proposed;
  if (overridden && !data.overrideReason) return { error: "סכום שונה מההצעה דורש סיבה" };

  const impact = shrinkImpact(ctx.plans, asCancelled(ctx.plans, data.planId, today), ctx.rows, today);
  const recorded = await undoPlan(db, ctx, {
    plan: { status: "cancelled", ended_on: today },
    refund: {
      reason: data.reason,
      amount_ils: data.amountIls,
      proposed_amount_ils: assessed.proposal.proposed,
      override_reason: overridden ? data.overrideReason : null,
      defect: data.defect,
      method: data.method,
      reference: data.reference,
      created_by: user!.id,
    },
    // Money went back: the order is refunded. Nothing went back: it stays paid.
    orderStatus: data.amountIls > 0 ? "refunded" : null,
    cancelled: impact.cancelled,
    actorName: staff?.full_name ?? "צוות",
    logMetadata: {
      planId: data.planId,
      orderId: ctx.order?.id ?? null,
      reason: data.reason,
      proposedIls: assessed.proposal.proposed,
      amountIls: data.amountIls,
      overrideReason: overridden ? (data.overrideReason ?? null) : null,
      defect: data.defect,
      method: data.method,
      bookingsMoved: impact.moved.length,
      bookingsCancelled: impact.cancelled.length,
    },
  });
  if ("error" in recorded) return recorded;
  const refund = { id: recorded.refundId };
  const cancelledCount = impact.cancelled.length;

  revalidateStaffSurfaces(ctx.plan.profile_id);
  return {
    ok: true,
    refundId: refund.id,
    receiptUrl: ctx.order?.morning_document_url ?? null,
    cancelledCount,
    movedCount: impact.moved.length,
  };
}
