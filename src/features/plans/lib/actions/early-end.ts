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
import { guardedShrinkArgs } from "../apply-shrink";
import { guardRefusal, loadPlanContext, toBooking, withPlanChange, type AffectedBooking, type PlanContext } from "../plan-context";
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
 * An Early end, whole or not at all (end_plan_early): the Plan ends today, the
 * Bookings the shrink rule drops are cancelled, and the reason and actor are
 * recorded, in one transaction under the per-trainee booking lock. It refuses
 * a Plan already ended or a roster or queue that changed since ctx was read,
 * so a Booking made in between cannot escape the shrink rule.
 */
async function endEarly(
  db: SupabaseClient<Database>,
  ctx: PlanContext,
  audit: { reason: string; today: string; actorId: string; actorName: string; impact: ShrinkImpact },
): Promise<string | null> {
  const { error } = await db.rpc("end_plan_early", {
    p_plan_id: ctx.plan.id,
    p_ended_on: audit.today,
    p_actor: audit.actorId,
    p_actor_name: audit.actorName,
    p_log_metadata: {
      planId: ctx.plan.id,
      reason: audit.reason,
      endedOn: audit.today,
      bookingsMoved: audit.impact.moved.length,
      bookingsCancelled: audit.impact.cancelled.length,
    },
    ...guardedShrinkArgs(ctx, audit.impact.cancelled),
  });
  if (!error) return null;
  const known = guardRefusal(error.message);
  if (known) return known;
  console.error("[early-end] end_plan_early failed:", error.message);
  return "סיום המסלול נכשל. נסו שוב.";
}

/**
 * Early end: the Current plan ends today and the Queued plan behind it starts
 * today. What is left on it is forfeited; no order, refund or receipt
 * changes. Bookings that no longer fit follow the shrink rule.
 */
export async function earlyEndPlanAction(
  input: EarlyEndInput,
): Promise<{ ok: true; cancelledCount: number; movedCount: number } | { error: string }> {
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
  const failed = await endEarly(db, ctx, {
    reason: parsed.data.reason,
    today,
    actorId: user!.id,
    actorName: staff?.full_name ?? "צוות",
    impact,
  });
  if (failed) return { error: failed };

  revalidateStaffSurfaces(ctx.plan.profile_id);
  return { ok: true, cancelledCount: impact.cancelled.length, movedCount: impact.moved.length };
}
