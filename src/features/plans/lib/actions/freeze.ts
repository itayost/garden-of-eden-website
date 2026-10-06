"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { freezeProblem } from "@/lib/plans/freeze";
import { resolvePlanQueue, type PlanFreeze, type PlanQueue } from "@/lib/plans/plan-queue";
import { shrinkImpact } from "@/lib/plans/shrink";
import { guardArgs } from "@/lib/plans/read-guard";
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
import type { StoredPlan } from "../queries";

export interface FreezePreview {
  refusal: string | null;
  /** The Plan's last day now, and with the Freeze (an open-ended one counted to today). */
  endsOn: string;
  endsOnAfter: string | null;
  moved: AffectedBooking[];
  cancelled: AffectedBooking[];
}

type FreezeResult = { ok: true; cancelledCount: number; incomplete: boolean } | { error: string };

/** The Plan's last day in this queue. */
const endIn = (queue: PlanQueue<StoredPlan>, ctx: PlanContext): string =>
  queue.plans.find((e) => e.plan.id === ctx.plan.id)?.expiresOn ?? ctx.plan.ends_on;

/** The Trainee's Plans with this one holding these Freezes. */
const withFreezes = (ctx: PlanContext, freezes: readonly PlanFreeze[]) =>
  withPlanChange(ctx.plans, ctx.plan.id, { freezes });

/** Why this Freeze cannot go on the Plan, given its queue now, or null. */
function refusalFor(ctx: PlanContext, queue: PlanQueue<StoredPlan>, freeze: PlanFreeze): string | null {
  // Its dates live in Arbox; freezing it here would part the two.
  if (ctx.plan.paidInArbox) return "מסלול ששולם ב-Arbox מוקפא ב-Arbox";
  // A queued Arbox Plan keeps the end Arbox gave it, so a Freeze here would
  // cost it the frozen days; it is frozen in Arbox too (owner, 2026-10-06).
  if (queue.queued.some((e) => e.plan.paidInArbox)) return "יש בתור מסלול מ-Arbox: מקפיאים גם ב-Arbox";
  return freezeProblem(queue, ctx.plan.id, freeze);
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
  const before = resolvePlanQueue(ctx.plans, ctx.rows, today);
  const base = { endsOn: endIn(before, ctx) };
  const refusal = refusalFor(ctx, before, freeze);
  if (refusal) return { ...base, refusal, endsOnAfter: null, moved: [], cancelled: [] };

  const after = withFreezes(ctx, [...(ctx.plan.freezes ?? []), freeze]);
  const impact = shrinkImpact(ctx.plans, after, ctx.rows, today);
  return {
    ...base,
    refusal: null,
    endsOnAfter: endIn(resolvePlanQueue(after, ctx.rows, today), ctx),
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

/** What a freeze function compares under the lock, and the Plan's cached end it writes. */
type GuardArgs = { p_plan_ends_on: string; p_counted_row_ids: string[]; p_plan_stamps: string[] };

/** Writes a Freeze change through its function, then runs the shrink rule and refreshes staff screens. */
async function commitFreeze(
  db: ReturnType<typeof createAdminClient>,
  ctx: PlanContext,
  after: StoredPlan[],
  today: string,
  write: (guard: GuardArgs) => PromiseLike<{ error: { message: string } | null }>,
  failed: string,
): Promise<FreezeResult> {
  const { error } = await write({
    p_plan_ends_on: endIn(resolvePlanQueue(after, ctx.rows, today), ctx),
    ...guardArgs(ctx.rows, ctx.plans),
  });
  if (error) {
    const known = freezeRefusal(error.message);
    if (known) return { error: known };
    console.error("[freeze] rpc failed:", error.message);
    return { error: failed };
  }
  const { cancelledCount, incomplete } = await applyShrinkAfter(db, ctx, after, today);
  return { ok: true, cancelledCount, incomplete };
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
  const refusal = refusalFor(ctx, resolvePlanQueue(ctx.plans, ctx.rows, today), freeze);
  if (refusal) return { error: refusal };

  const after = withFreezes(ctx, [...(ctx.plan.freezes ?? []), freeze]);
  return commitFreeze(
    db,
    ctx,
    after,
    today,
    (guard) =>
      db.rpc("freeze_plan", {
        p_plan_id: ctx.plan.id,
        p_starts_on: data.startsOn,
        // The generated types mark every argument required; NULL is an open-ended Freeze.
        p_ends_on: data.endsOn as string,
        p_reason: data.reason,
        p_actor: user!.id,
        ...guard,
      }),
    "ההקפאה נכשלה. נסו שוב.",
  );
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

  // end_freeze refuses an end before the start (invalid_dates).
  const after = withFreezes(ctx, freezes.map((f) => (f === open ? { ...f, endsOn } : f)));
  return commitFreeze(
    db,
    ctx,
    after,
    israelToday(),
    (guard) => db.rpc("end_freeze", { p_freeze_id: freezeId, p_ends_on: endsOn, p_actor: user!.id, ...guard }),
    "סיום ההקפאה נכשל. נסו שוב.",
  );
}
