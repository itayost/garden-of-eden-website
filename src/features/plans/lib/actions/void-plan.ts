"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { creditNoteSchema, voidPlanSchema, type RefundMethod, type VoidPlanInput } from "@/lib/validations/plans-admin";
import { shrinkImpact, voidRefusal } from "@/lib/plans/shrink";
import type { QueueRow } from "@/lib/plans/plan-queue";
import type { Order } from "@/types/plans";
import { applyShrinkCancellations } from "../apply-shrink";
import { loadQueueRows, loadStoredPlans, type StoredPlan } from "../queries";
import { revalidateStaffSurfaces } from "../revalidate-staff";

type OrderBits = Pick<Order, "id" | "status" | "amount_ils" | "payment_method" | "morning_document_url">;

export interface AffectedBooking {
  date: string;
  /** HH:MM */
  time: string;
}

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

interface VoidContext {
  plan: StoredPlan;
  plans: StoredPlan[];
  rows: QueueRow[];
  order: OrderBits | null;
}

/** The Plan, its Trainee's whole queue and roster, and its order; after the scope check. */
async function loadVoidContext(db: SupabaseClient, planId: string): Promise<VoidContext | { error: string }> {
  const { data: head } = (await typedFrom(db, "trainee_plans")
    .select("profile_id, branch_id")
    .eq("id", planId)
    .maybeSingle()) as { data: { profile_id: string; branch_id: string } | null };
  if (!head) return { error: "המסלול לא נמצא" };
  const denied = await verifyAdminOrBranchManager([head.branch_id]);
  if (denied) return { error: denied };

  const [plansByProfile, rowsByProfile] = await Promise.all([
    loadStoredPlans(db, [head.profile_id]),
    loadQueueRows(db, [head.profile_id]),
  ]);
  const plans = plansByProfile.get(head.profile_id) ?? [];
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return { error: "המסלול לא נמצא" };

  const { data: order } = plan.order_id
    ? ((await typedFrom(db, "orders")
        .select("id, status, amount_ils, payment_method, morning_document_url")
        .eq("id", plan.order_id)
        .maybeSingle()) as { data: OrderBits | null })
    : { data: null };
  return { plan, plans, rows: rowsByProfile.get(head.profile_id) ?? [], order };
}

const asVoided = (plans: readonly StoredPlan[], planId: string): StoredPlan[] =>
  plans.map((p) => (p.id === planId ? { ...p, status: "voided" as const } : p));

const toBooking = (row: { schedule_date: string; start_time: string }): AffectedBooking => ({
  date: row.schedule_date,
  time: row.start_time.slice(0, 5),
});

/** What a Void would do, for the confirmation. Admins and Branch managers of the Plan's branch. */
export async function previewVoidAction(planId: string): Promise<VoidPreview | { error: string }> {
  if (!isValidUUID(planId)) return { error: "מזהה לא תקין" };
  const db = createAdminClient();
  const ctx = await loadVoidContext(db, planId);
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
 * is claimed first (only one request can move it to voided), then the audit
 * record is written, the order voided and the shrink rule run. The system moves
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
  const ctx = await loadVoidContext(db, data.planId);
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const refusal = voidRefusal(ctx.plans, ctx.rows, data.planId, today);
  if (refusal) return { error: refusal };
  if (ctx.order && data.amountIls > Number(ctx.order.amount_ils)) {
    return { error: "סכום ההחזר גבוה מהסכום ששולם" };
  }

  const previousStatus = ctx.plan.status;
  const { data: claimed, error: claimError } = (await typedFrom(db, "trainee_plans")
    .update({ status: "voided" })
    .eq("id", data.planId)
    .eq("status", previousStatus)
    .select("id")) as { data: { id: string }[] | null; error: { message: string } | null };
  if (claimError) {
    console.error("[void] plan update failed:", claimError.message);
    return { error: "ביטול הרישום נכשל. נסו שוב." };
  }
  if (!claimed?.length) return { error: "המסלול השתנה בינתיים. פתחו אותו מחדש ונסו שוב." };

  const { data: refund, error: refundError } = await db
    .from("plan_refunds")
    .insert({
      plan_id: data.planId,
      order_id: ctx.order?.id ?? null,
      kind: "void",
      reason: data.reason,
      amount_ils: data.amountIls,
      method: data.method,
      reference: data.reference,
      created_by: user!.id,
    })
    .select("id")
    .single();
  if (refundError || !refund) {
    // No audit record, no Void: hand the Plan back.
    console.error("[void] refund record failed:", refundError?.message);
    await typedFrom(db, "trainee_plans").update({ status: previousStatus }).eq("id", data.planId);
    return { error: "שמירת הביטול נכשלה. נסו שוב." };
  }

  if (ctx.order) {
    const { error: orderError } = await typedFrom(db, "orders").update({ status: "voided" }).eq("id", ctx.order.id);
    if (orderError) {
      // A voided Plan on a paid order would count as revenue: undo it all.
      console.error("[void] order update failed:", orderError.message);
      await db.from("plan_refunds").delete().eq("id", refund.id);
      await typedFrom(db, "trainee_plans").update({ status: previousStatus }).eq("id", data.planId);
      return { error: "ביטול הרישום נכשל. נסו שוב." };
    }
  }

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
