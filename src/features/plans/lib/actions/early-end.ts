"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { earlyEndRefusal, shrinkImpact, type ShrinkImpact } from "@/lib/plans/shrink";
import { earlyEndSchema, type EarlyEndInput } from "@/lib/validations/plans-admin";
import type { Database } from "@/types/database";
import { applyShrinkCancellations } from "../apply-shrink";
import { loadPlanContext, toBooking, withPlanChange, type AffectedBooking, type PlanContext } from "../plan-context";
import { revalidateStaffSurfaces } from "../revalidate-staff";

export interface EarlyEndPreview {
  planName: string;
  /** The Plan that becomes current today. */
  nextPlanName: string | null;
  refusal: string | null;
  moved: AffectedBooking[];
  cancelled: AffectedBooking[];
}

/** Every reason the Current plan cannot end early today, or null. */
function refusalFor(ctx: PlanContext, today: string): string | null {
  // Its dates and sessions live in Arbox; ending it here would part the two.
  if (ctx.order?.payment_method === "arbox") return "מסלול ששולם ב-Arbox מסתיים ב-Arbox";
  return earlyEndRefusal(ctx.plans, ctx.rows, ctx.plan.id, today);
}

const impactOf = (ctx: PlanContext, today: string): ShrinkImpact =>
  shrinkImpact(ctx.plans, withPlanChange(ctx.plans, ctx.plan.id, { endedOn: today }), ctx.rows, today);

/** What an Early end would do, for the confirmation. Admins and Branch managers of the Plan's branch. */
export async function previewEarlyEndAction(planId: string): Promise<EarlyEndPreview | { error: string }> {
  if (!isValidUUID(planId)) return { error: "מזהה לא תקין" };
  const db = createAdminClient();
  const ctx = await loadPlanContext(db, planId);
  if ("error" in ctx) return ctx;

  const today = israelToday();
  const next = resolvePlanQueue(ctx.plans, ctx.rows, today).queued[0];
  const impact = impactOf(ctx, today);
  return {
    planName: ctx.plan.product?.name_he ?? "מסלול",
    nextPlanName: next ? (next.plan.product?.name_he ?? "מסלול") : null,
    refusal: refusalFor(ctx, today),
    moved: impact.moved.map((m) => toBooking(m.row)),
    cancelled: impact.cancelled.map(toBooking),
  };
}

/**
 * Claims the Plan (only one request ends it) and writes the audit record:
 * the reason and the actor. Without the record there is no Early end, so a
 * failed log puts back exactly the claim this request made.
 */
async function claimAndLog(
  db: SupabaseClient<Database>,
  ctx: PlanContext,
  audit: { reason: string; today: string; actorId: string; actorName: string; impact: ShrinkImpact },
): Promise<string | null> {
  const { data: claimed, error: claimError } = await db
    .from("trainee_plans")
    .update({ ended_on: audit.today })
    .eq("id", ctx.plan.id)
    .eq("status", "active")
    .is("ended_on", null)
    .select("id");
  if (claimError) {
    console.error("[early-end] plan update failed:", claimError.message);
    return "סיום המסלול נכשל. נסו שוב.";
  }
  if (!claimed?.length) return "המסלול השתנה בינתיים. פתחו אותו מחדש ונסו שוב.";

  const { error: logError } = await db.from("activity_logs").insert({
    user_id: ctx.plan.profile_id,
    action: "plan_ended_early",
    actor_id: audit.actorId,
    actor_name: audit.actorName,
    metadata: {
      planId: ctx.plan.id,
      reason: audit.reason,
      endedOn: audit.today,
      bookingsMoved: audit.impact.moved.length,
      bookingsToCancel: audit.impact.cancelled.length,
    },
  });
  if (logError) {
    console.error("[early-end] activity log failed:", logError.message);
    await db
      .from("trainee_plans")
      .update({ ended_on: null })
      .eq("id", ctx.plan.id)
      .eq("status", "active")
      .eq("ended_on", audit.today);
    return "שמירת הסיבה נכשלה, והמסלול לא הסתיים. נסו שוב.";
  }
  return null;
}

/**
 * Early end: the Current plan ends today and the Queued plan behind it starts
 * today. What is left on it is forfeited; no order, refund or receipt
 * changes. Bookings that no longer fit follow the shrink rule.
 */
export async function earlyEndPlanAction(
  input: EarlyEndInput,
): Promise<{ ok: true; cancelledCount: number; movedCount: number; incomplete: boolean } | { error: string }> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = earlyEndSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const ctx = await loadPlanContext(db, parsed.data.planId);
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const refusal = refusalFor(ctx, today);
  if (refusal) return { error: refusal };

  const impact = impactOf(ctx, today);
  const failed = await claimAndLog(db, ctx, {
    reason: parsed.data.reason,
    today,
    actorId: user!.id,
    actorName: staff?.full_name ?? "צוות",
    impact,
  });
  if (failed) return { error: failed };

  const cancelledCount = await applyShrinkCancellations(db, ctx.plan.profile_id, impact.cancelled);
  const incomplete = cancelledCount < impact.cancelled.length;
  if (incomplete) {
    console.error(`[early-end] plan ${ctx.plan.id}: cancelled ${cancelledCount} of ${impact.cancelled.length} bookings`);
  }
  revalidateStaffSurfaces(ctx.plan.profile_id);
  return { ok: true, cancelledCount, movedCount: impact.moved.length, incomplete };
}
