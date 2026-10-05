"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { creditNoteSchema, voidPlanSchema, type RefundMethod, type VoidPlanInput } from "@/lib/validations/plans-admin";
import { shrinkImpact, voidRefusal } from "@/lib/plans/shrink";
import { applyShrinkCancellations } from "../apply-shrink";
import type { StoredPlan } from "../queries";
import { loadPlanContext, toBooking, withPlanChange, type AffectedBooking } from "../plan-context";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { claimAndRecordUndo } from "../undo-plan";

export type { AffectedBooking } from "../plan-context";

export interface VoidPreview {
  planName: string;
  /** Why it cannot be voided; null when it can. */
  refusal: string | null;
  /** What was paid; null when the Plan has no order. */
  amountPaid: number | null;
  /** How it was paid, to suggest the same way back. */
  suggestedMethod: RefundMethod;
  /** The Morning receipt to credit by hand; null when there is none. */
  receiptUrl: string | null;
  /** Bookings another Plan in the queue will pay for. */
  moved: AffectedBooking[];
  /** Bookings that will be cancelled, latest first. */
  cancelled: AffectedBooking[];
}

const asVoided = (plans: readonly StoredPlan[], planId: string) => withPlanChange(plans, planId, { status: "voided" });

/** What a Void would do, for the confirmation. Admins and Branch managers of the Plan's branch. */
export async function previewVoidAction(planId: string): Promise<VoidPreview | { error: string }> {
  if (!isValidUUID(planId)) return { error: "מזהה לא תקין" };
  const db = createAdminClient();
  const ctx = await loadPlanContext(db, planId);
  if ("error" in ctx) return ctx;

  const today = israelToday();
  const impact = shrinkImpact(ctx.plans, asVoided(ctx.plans, planId), ctx.rows, today);
  return {
    planName: ctx.plan.product?.name_he ?? "מסלול",
    refusal: voidRefusal(ctx.plans, ctx.rows, planId, today),
    amountPaid: ctx.order ? Number(ctx.order.amount_ils) : null,
    // The same way back as in; an order paid on Morning's hosted page has no
    // method stored, and was paid by card.
    suggestedMethod: ctx.order ? (ctx.order.payment_method ?? "card") : "none",
    receiptUrl: ctx.order?.morning_document_url ?? null,
    moved: impact.moved.map((m) => toBooking(m.row)),
    cancelled: impact.cancelled.map(toBooking),
  };
}

export type VoidOutcome =
  | { ok: true; refundId: string; receiptUrl: string | null; cancelledCount: number; movedCount: number }
  | { error: string };

/**
 * A Void: the Plan recorded by mistake is undone as if never sold. The Plan
 * is claimed, the audit record written and the order voided together
 * (claimAndRecordUndo), then the shrink rule runs. The system moves
 * no money: the refund was made by a person, and the Morning credit note is
 * issued by hand and recorded with recordCreditNoteAction.
 */
export async function voidPlanAction(input: VoidPlanInput): Promise<VoidOutcome> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = voidPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const ctx = await loadPlanContext(db, data.planId);
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const refusal = voidRefusal(ctx.plans, ctx.rows, data.planId, today);
  if (refusal) return { error: refusal };
  if (ctx.order && data.amountIls > Number(ctx.order.amount_ils)) {
    return { error: "סכום ההחזר גבוה מהסכום ששולם" };
  }

  const recorded = await claimAndRecordUndo(db, ctx, {
    plan: { status: "voided" },
    refund: {
      kind: "void",
      reason: data.reason,
      amount_ils: data.amountIls,
      method: data.method,
      reference: data.reference,
      created_by: user!.id,
    },
    orderStatus: "voided",
  });
  if ("error" in recorded) return recorded;
  const refund = { id: recorded.refundId };

  const impact = shrinkImpact(ctx.plans, asVoided(ctx.plans, data.planId), ctx.rows, today);
  const cancelledCount = await applyShrinkCancellations(db, ctx.plan.profile_id, impact.cancelled);

  const { error: logError } = await db.from("activity_logs").insert({
    user_id: ctx.plan.profile_id,
    action: "plan_voided",
    actor_id: user!.id,
    actor_name: staff?.full_name ?? "צוות",
    metadata: {
      planId: data.planId,
      orderId: ctx.order?.id ?? null,
      refundId: refund.id,
      reason: data.reason,
      amountIls: data.amountIls,
      method: data.method,
      bookingsMoved: impact.moved.length,
      bookingsCancelled: cancelledCount,
    },
  });
  if (logError) console.error("[void] activity log failed:", logError.message);

  revalidateStaffSurfaces(ctx.plan.profile_id);
  return {
    ok: true,
    refundId: refund.id,
    receiptUrl: ctx.order?.morning_document_url ?? null,
    cancelledCount,
    movedCount: impact.moved.length,
  };
}

/** Records the number of the credit note staff issued in Morning for a refund. */
export async function recordCreditNoteAction(input: {
  refundId: string;
  creditNoteNumber: string;
}): Promise<{ success: true } | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = creditNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data: refund } = await db
    .from("plan_refunds")
    .select("plan:trainee_plans!plan_refunds_plan_id_fkey(profile_id, branch_id)")
    .eq("id", parsed.data.refundId)
    .maybeSingle();
  if (!refund?.plan) return { error: "רישום ההחזר לא נמצא" };
  const denied = await verifyAdminOrBranchManager([refund.plan.branch_id]);
  if (denied) return { error: denied };

  const { error } = await db
    .from("plan_refunds")
    .update({ credit_note_number: parsed.data.creditNoteNumber, credit_note_recorded_at: new Date().toISOString() })
    .eq("id", parsed.data.refundId);
  if (error) return { error: "שמירת מספר הזיכוי נכשלה" };
  revalidateStaffSurfaces(refund.plan.profile_id);
  return { success: true };
}
