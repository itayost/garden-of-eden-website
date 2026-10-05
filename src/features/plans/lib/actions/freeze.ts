"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { freezeProblem } from "@/lib/plans/freeze";
import { resolvePlanQueue, type PlanFreeze } from "@/lib/plans/plan-queue";
import { shrinkImpact } from "@/lib/plans/shrink";
import { countedRowIds } from "@/lib/schedule/booking-rules";
import {
  endFreezeSchema,
  freezePlanSchema,
  freezePreviewSchema,
  type EndFreezeInput,
  type FreezePlanInput,
} from "@/lib/validations/plans-admin";
import { applyShrinkAfter } from "../apply-shrink";
import {
  guardRefusal,
  loadPlanContext,
  toBooking,
  withPlanChange,
  type AffectedBooking,
  type PlanContext,
} from "../plan-context";
import { planStamps, type StoredPlan } from "../queries";

export interface FreezePreview {
  planName: string;
  refusal: string | null;
  /** The Plan's last day now, and with the Freeze (an open-ended one counted to today). */
  endsOn: string;
  endsOnAfter: string | null;
  moved: AffectedBooking[];
  cancelled: AffectedBooking[];
}

type FreezeResult = { ok: true; cancelledCount: number; incomplete: boolean } | { error: string };

/** The Plan's last day in its queue under these Plans. */
function planEnd(plans: readonly StoredPlan[], ctx: PlanContext, today: string): string {
  const entry = resolvePlanQueue(plans, ctx.rows, today).plans.find((e) => e.plan.id === ctx.plan.id);
  return entry?.expiresOn ?? ctx.plan.ends_on;
}

/** The Trainee's Plans with this one holding these Freezes. */
const withFreezes = (ctx: PlanContext, freezes: readonly PlanFreeze[]) =>
  withPlanChange(ctx.plans, ctx.plan.id, { freezes });

/** Why this Freeze cannot go on the Plan, or null. */
function refusalFor(ctx: PlanContext, freeze: PlanFreeze, today: string): string | null {
  // Its dates live in Arbox; freezing it here would part the two.
  if (ctx.plan.paidInArbox) return "מסלול ששולם ב-Arbox מוקפא ב-Arbox";
  return freezeProblem(resolvePlanQueue(ctx.plans, ctx.rows, today), ctx.plan.id, freeze);
}

/** What a Freeze over these dates would do, for the confirmation. Admins and Branch managers. */
export async function previewFreezeAction(
  planId: string,
  startsOn: string,
  endsOn: string | null,
): Promise<FreezePreview | { error: string }> {
  const parsed = freezePreviewSchema.safeParse({ planId, startsOn, endsOn });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const ctx = await loadPlanContext(createAdminClient(), planId, { withOrder: false });
  if ("error" in ctx) return ctx;

  const today = israelToday();
  const freeze: PlanFreeze = { startsOn, endsOn };
  const base = { planName: ctx.plan.product?.name_he ?? "מסלול", endsOn: planEnd(ctx.plans, ctx, today) };
  const refusal = refusalFor(ctx, freeze, today);
  if (refusal) return { ...base, refusal, endsOnAfter: null, moved: [], cancelled: [] };

  const after = withFreezes(ctx, [...(ctx.plan.freezes ?? []), freeze]);
  const impact = shrinkImpact(ctx.plans, after, ctx.rows, today);
  return {
    ...base,
    refusal: null,
    endsOnAfter: planEnd(after, ctx, today),
    moved: impact.moved.map((m) => toBooking(m.row)),
    cancelled: impact.cancelled.map(toBooking),
  };
}

/** The Hebrew for a freeze function's refusal; null for an unexpected error. */
function freezeRefusal(message: string): string | null {
  if (message.includes("freeze_overlap")) return "ההקפאה חופפת להקפאה קיימת";
  if (message.includes("freeze_not_open")) return "ההקפאה כבר הסתיימה";
  if (message.includes("invalid_dates")) return "תאריך הסיום קודם לתאריך ההתחלה";
  return guardRefusal(message);
}

/**
 * A Freeze on the Current plan: it does not run on those days, its end and
 * the queue behind it move by them, and Bookings inside follow the shrink
 * rule. freeze_plan writes it under the per-trainee lock.
 */
export async function freezePlanAction(input: FreezePlanInput): Promise<FreezeResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = freezePlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const ctx = await loadPlanContext(db, data.planId, { withOrder: false });
  if ("error" in ctx) return ctx;
  const today = israelToday();
  const freeze: PlanFreeze = { startsOn: data.startsOn, endsOn: data.endsOn };
  const refusal = refusalFor(ctx, freeze, today);
  if (refusal) return { error: refusal };

  const after = withFreezes(ctx, [...(ctx.plan.freezes ?? []), freeze]);
  const { error } = await db.rpc("freeze_plan", {
    p_plan_id: ctx.plan.id,
    p_starts_on: data.startsOn,
    // The generated types mark every argument required; NULL is an open-ended Freeze.
    p_ends_on: data.endsOn as string,
    p_plan_ends_on: planEnd(after, ctx, today),
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_plan_stamps: planStamps(ctx.plans),
    p_reason: data.reason,
    p_actor: user!.id,
  });
  if (error) {
    const known = freezeRefusal(error.message);
    if (known) return { error: known };
    console.error("[freeze] rpc failed:", error.message);
    return { error: "ההקפאה נכשלה. נסו שוב." };
  }

  const { cancelledCount, incomplete } = await applyShrinkAfter(db, ctx, after, today);
  return { ok: true, cancelledCount, incomplete };
}

/** Ends an open-ended Freeze on a day; its length is counted then and the queue moves by it. */
export async function endFreezeAction(input: EndFreezeInput): Promise<FreezeResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = endFreezeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const { freezeId, endsOn } = parsed.data;

  const db = createAdminClient();
  const { data: row } = await db.from("plan_freezes").select("plan_id").eq("id", freezeId).maybeSingle();
  if (!row) return { error: "ההקפאה לא נמצאה" };
  const ctx = await loadPlanContext(db, row.plan_id, { withOrder: false });
  if ("error" in ctx) return ctx;

  const freezes = ctx.plan.freezes ?? [];
  const open = freezes.find((f) => f.id === freezeId && f.endsOn === null);
  if (!open) return { error: "ההקפאה כבר הסתיימה" };
  if (endsOn < open.startsOn) return { error: "תאריך הסיום קודם לתאריך ההתחלה" };

  const today = israelToday();
  const after = withFreezes(ctx, freezes.map((f) => (f === open ? { ...f, endsOn } : f)));
  const { error } = await db.rpc("end_freeze", {
    p_freeze_id: freezeId,
    p_ends_on: endsOn,
    p_plan_ends_on: planEnd(after, ctx, today),
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_plan_stamps: planStamps(ctx.plans),
    p_actor: user!.id,
  });
  if (error) {
    const known = freezeRefusal(error.message);
    if (known) return { error: known };
    console.error("[freeze] end rpc failed:", error.message);
    return { error: "סיום ההקפאה נכשל. נסו שוב." };
  }

  const { cancelledCount, incomplete } = await applyShrinkAfter(db, ctx, after, today);
  return { ok: true, cancelledCount, incomplete };
}
