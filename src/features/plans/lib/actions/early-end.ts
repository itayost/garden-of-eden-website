"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { earlyEndRefusal, shrinkImpact, type ShrinkImpact } from "@/lib/plans/shrink";
import { earlyEndSchema, type EarlyEndInput } from "@/lib/validations/plans-admin";
import { guardedShrinkArgs } from "../apply-shrink";
import { readToken } from "@/lib/plans/read-guard";
import { actFailure, loadPlanContext, STALE_READ, toBooking, withPlanChange, type AffectedBooking, type PlanContext } from "../plan-context";
import { revalidateStaffSurfaces } from "../revalidate-staff";

export interface EarlyEndPreview {
  planName: string;
  /** The Plan that becomes current today. */
  nextPlanName: string | null;
  refusal: string | null;
  moved: AffectedBooking[];
  cancelled: AffectedBooking[];
  /** Sent back with the act: it is refused if the roster or Plans moved since. */
  readToken: string;
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
    readToken: readToken(ctx.rows, ctx.plans),
  };
}

/**
 * Early end: the Current plan ends today and the Queued plan behind it starts
 * today. What is left on it is forfeited; no order, refund or receipt
 * changes. end_plan_early ends it, cancels the Bookings the shrink rule drops
 * and records the reason in one transaction under the per-trainee booking
 * lock, refused if the roster or Plans changed since ctx was read.
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
  if (readToken(ctx.rows, ctx.plans) !== parsed.data.readToken) return { error: STALE_READ };
  const refusal = refusalFor(ctx, today);
  if (refusal) return { error: refusal };

  const impact = impactOf(ctx, today);
  const { error } = await db.rpc("end_plan_early", {
    p_plan_id: ctx.plan.id,
    p_ended_on: today,
    p_actor: user!.id,
    p_actor_name: staff?.full_name ?? "צוות",
    p_log_metadata: {
      planId: ctx.plan.id,
      reason: parsed.data.reason,
      endedOn: today,
      bookingsMoved: impact.moved.length,
      bookingsCancelled: impact.cancelled.length,
    },
    ...guardedShrinkArgs(ctx, impact.cancelled),
  });
  if (error) return { error: actFailure("early-end", error, "סיום המסלול נכשל. נסו שוב.") };

  revalidateStaffSurfaces(ctx.plan.profile_id);
  return { ok: true, cancelledCount: impact.cancelled.length, movedCount: impact.moved.length };
}
