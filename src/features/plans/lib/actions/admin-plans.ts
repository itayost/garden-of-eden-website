"use server";

import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import {
  extendPlanSchema,
} from "@/lib/validations/plans-admin";
import type { EnrollmentAgreement, Order, PlanStatus } from "@/types/plans";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { daysBetween } from "@/lib/utils/iso-date";
import { applyShrinkAfter } from "../apply-shrink";
import { planHistory, type PlanHistoryRow } from "@/lib/plans/plan-history";
import {
  loadPlanQueues,
  loadStoredPlans,
  type PlanQueueView,
  type StoredPlan,
} from "../queries";
import { countedRowIds, loadPlanContext, STALE_READ, withPlanChange } from "../plan-context";

export type AdminPlanRow = PlanQueueView & {
  traineeName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  orderDocumentUrl: string | null;
  /** The agreement behind the plan's order, and whether the parent has signed it. */
  agreementId: string | null;
  agreementSigned: boolean;
  /** Who took a manual payment. */
  receivedByName: string | null;
  /** Every Plan the Trainee holds; only on the single-trainee views. */
  history?: PlanHistoryRow<StoredPlan>[];
};

/** The current plan of every trainee in one branch (or all the caller may see), newest ending first. */
export async function listPlansAction(filter: {
  branchId?: string;
  status?: PlanStatus;
}): Promise<AdminPlanRow[]> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return [];

  const db = createAdminClient();
  const branchId = filter.branchId && isValidUUID(filter.branchId) ? filter.branchId : undefined;
  // null = unrestricted (admin); [] = nothing visible; never an empty .in().
  const visible = await visibleProfileIds(db, scopeResult.data.scope, branchId);
  if (visible !== null && visible.length === 0) return [];

  let query = typedFrom(db, "trainee_plans").select("profile_id, branch_id");
  if (branchId) query = query.eq("branch_id", branchId);
  if (visible !== null) query = query.in("profile_id", visible);
  const { data: rows } = (await query) as { data: { profile_id: string }[] | null };
  const profileIds = Array.from(new Set((rows ?? []).map((r) => r.profile_id)));
  const all = await loadAdminRows(db, profileIds);
  return all
    .filter((row) => !filter.status || row.status === filter.status)
    .sort((a, b) => (a.endsOn < b.endsOn ? 1 : -1));
}

/** One trainee's current plan for the user page; null when they have none. */
export async function getPlanForProfileAction(profileId: string): Promise<AdminPlanRow | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error || !isValidUUID(profileId)) return null;
  if (await assertTraineeInScope(profileId)) return null;
  const db = createAdminClient();
  const [rows, plans] = await Promise.all([loadAdminRows(db, [profileId]), loadStoredPlans(db, [profileId])]);
  const row = rows[0];
  if (!row) return null;
  return { ...row, history: planHistory(plans.get(profileId) ?? [], row.queue) };
}

async function loadAdminRows(
  db: ReturnType<typeof createAdminClient>,
  profileIds: readonly string[],
): Promise<AdminPlanRow[]> {
  if (profileIds.length === 0) return [];
  const [plans, { data: profiles }] = await Promise.all([
    loadPlanQueues(db, profileIds, israelToday()),
    db.from("profiles").select("id, full_name, guardian_name, guardian_phone").in("id", profileIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const orderIds = [...plans.values()]
    .map((p) => p.plan.order_id)
    .filter((id): id is string => id !== null);
  type OrderBits = Pick<Order, "id" | "morning_document_url" | "received_by"> & {
    agreements: Pick<EnrollmentAgreement, "id" | "signed_at">[] | null;
    receiver: { full_name: string | null } | null;
  };
  const { data: orders } = (orderIds.length
    ? await typedFrom(db, "orders")
        .select(
          "id, morning_document_url, received_by, agreements:enrollment_agreements(id, signed_at), receiver:profiles!orders_received_by_fkey(full_name)",
        )
        .in("id", orderIds)
    : { data: [] }) as { data: OrderBits[] | null };
  const byOrder = new Map((orders ?? []).map((o) => [o.id, o]));

  return [...plans.entries()]
    .map(([profileId, view]) => {
      const profile = profileById.get(profileId);
      const bits = view.plan.order_id ? byOrder.get(view.plan.order_id) : undefined;
      return {
        ...view,
        traineeName: profile?.full_name ?? "ללא שם",
        guardianName: profile?.guardian_name ?? null,
        guardianPhone: profile?.guardian_phone ?? null,
        orderDocumentUrl: bits?.morning_document_url ?? null,
        agreementId: bits?.agreements?.[0]?.id ?? null,
        agreementSigned: Boolean(bits?.agreements?.[0]?.signed_at),
        receivedByName: bits?.receiver?.full_name ?? null,
      };
    });
}

const PLAN_CHANGED = "המסלול השתנה בינתיים. רעננו ונסו שוב.";

/** The Plan's own dates in its queue (an Add-on keeps its own), after the scope check. */
async function loadExtendTarget(db: ReturnType<typeof createAdminClient>, planId: string, today: string) {
  const ctx = await loadPlanContext(db, planId, { withOrder: false });
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const stored = ctx.plan;
  if (stored.status !== "active" || stored.ended_on) {
    return { ok: false as const, error: "המסלול הסתיים או בוטל ואין מה להאריך" };
  }
  const entry = resolvePlanQueue(ctx.plans, ctx.rows, today).plans.find((e) => e.plan.id === stored.id);
  return { ok: true as const, ctx, startsOn: entry?.startsOn ?? stored.notBefore, endsBefore: entry?.expiresOn ?? stored.ends_on };
}

/**
 * A new end date for a Plan, on the same audit trail as Adjustments. The
 * queue dates the Plan, so the end becomes a new duration, or a new fixed end
 * for an Arbox purchase; adjust_plan_end_date writes it and its audit row
 * together, only if the end is still the one staff saw. Bookings the new end
 * leaves unpaid follow the shrink rule.
 */
export async function extendPlanAction(input: {
  planId: string;
  endsOn: string;
  expectedEndsOn: string;
  reason: string;
}): Promise<{ success: true; cancelledCount: number } | { error: string }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = extendPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const { planId, endsOn, expectedEndsOn, reason } = parsed.data;

  const db = createAdminClient();
  const today = israelToday();
  const target = await loadExtendTarget(db, planId, today);
  if (!target.ok) return { error: target.error };
  const { ctx, startsOn, endsBefore } = target;
  if (ctx.plan.ends_on !== expectedEndsOn) return { error: PLAN_CHANGED };
  if (endsOn < startsOn) return { error: "תאריך הסיום קודם לתאריך ההתחלה" };

  const fixed = ctx.plan.fixedEndsOn !== null;
  const durationDays = fixed ? null : daysBetween(startsOn, endsOn) + 1;
  const { error } = await db.rpc("adjust_plan_end_date", {
    p_plan_id: planId,
    p_expected_ends_on: expectedEndsOn,
    // The generated types mark every argument required; the function takes null for the term not used.
    p_duration_days: durationDays as number,
    p_fixed_ends_on: (fixed ? endsOn : null) as string,
    p_ends_on: endsOn,
    p_ends_before: endsBefore,
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_reason: reason,
    p_actor: user!.id,
  });
  if (error) {
    if (error.message.includes("plan_changed") || error.message.includes("plan_not_live")) {
      return { error: PLAN_CHANGED };
    }
    if (error.message.includes("roster_changed")) return { error: STALE_READ };
    console.error("[extend] rpc failed:", error.message);
    return { error: "שגיאה בעדכון המסלול" };
  }

  // Even a later end can move a queued Plan of another branch past a Booking; the rule decides.
  const after = withPlanChange(ctx.plans, planId, fixed ? { fixedEndsOn: endsOn } : { durationDays: durationDays! });
  const { cancelledCount } = await applyShrinkAfter(db, ctx, after, today);
  return { success: true, cancelledCount };
}
