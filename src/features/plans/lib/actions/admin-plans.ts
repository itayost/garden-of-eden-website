"use server";

import { revalidatePath } from "next/cache";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import {
  addSessionsSchema,
  cancelPlanSchema,
  extendPlanSchema,
} from "@/lib/validations/plans-admin";
import type { EnrollmentAgreement, Order, PlanStatus } from "@/types/plans";
import { resolvePlanQueue } from "@/lib/plans/plan-queue";
import { daysBetween } from "@/lib/utils/iso-date";
import { loadPlanQueues, loadQueueRows, loadStoredPlans, type PlanQueueView } from "../queries";

type ActionResult = { success: true } | { error: string };

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
};

function revalidatePlanSurfaces(profileId?: string): void {
  revalidatePath("/admin/plans");
  revalidatePath("/admin/users");
  if (profileId) revalidatePath(`/admin/users/${profileId}`);
}

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
  const rows = await loadAdminRows(createAdminClient(), [profileId]);
  return rows[0] ?? null;
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

export async function extendPlanAction(input: {
  planId: string;
  endsOn: string;
}): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = extendPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data: existing } = (await typedFrom(db, "trainee_plans")
    .select("profile_id, branch_id")
    .eq("id", parsed.data.planId)
    .maybeSingle()) as { data: { profile_id: string; branch_id: string } | null };
  if (!existing) return { error: "המסלול לא נמצא" };
  const denied = await verifyAdminOrBranchManager([existing.branch_id]);
  if (denied) return { error: denied };

  // The queue dates the Plan; a new end becomes a new duration, or a new
  // fixed end for an Arbox purchase.
  const [plans, rows] = await Promise.all([
    loadStoredPlans(db, [existing.profile_id]),
    loadQueueRows(db, [existing.profile_id]),
  ]);
  const own = plans.get(existing.profile_id) ?? [];
  const stored = own.find((p) => p.id === parsed.data.planId);
  if (!stored || stored.status === "cancelled") return { error: "המסלול בוטל ואין מה להאריך" };
  // An Add-on sits outside the queue and starts on its own date.
  const startsOn =
    resolvePlanQueue(own, rows.get(existing.profile_id) ?? [], israelToday()).plans.find(
      (e) => e.plan.id === stored.id,
    )?.startsOn ?? stored.notBefore;
  if (parsed.data.endsOn < startsOn) {
    return { error: "תאריך הסיום קודם לתאריך ההתחלה" };
  }
  const terms =
    stored.fixedEndsOn !== null
      ? { fixed_ends_on: parsed.data.endsOn }
      : { duration_days: daysBetween(startsOn, parsed.data.endsOn) + 1 };

  // A new end date deserves its own reminders.
  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({
      ...terms,
      not_before: stored.notBefore,
      ends_on: parsed.data.endsOn,
      reminded_3_days_at: null,
      reminded_last_session_at: null,
      reminded_expired_at: null,
    })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "שגיאה בעדכון המסלול" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}

export async function addSessionsAction(input: {
  planId: string;
  sessions: number;
}): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = addSessionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("profile_id, sessions_total, branch_id")
    .eq("id", parsed.data.planId)
    .maybeSingle()) as {
    data: { profile_id: string; sessions_total: number | null; branch_id: string } | null;
  };
  if (!plan) return { error: "המסלול לא נמצא" };
  const denied = await verifyAdminOrBranchManager([plan.branch_id]);
  if (denied) return { error: denied };
  if (plan.sessions_total === null) return { error: "למסלול לפי זמן אין מונה אימונים" };

  const { error } = await typedFrom(db, "trainee_plans")
    .update({
      sessions_total: plan.sessions_total + parsed.data.sessions,
      reminded_last_session_at: null,
      reminded_expired_at: null,
    })
    .eq("id", parsed.data.planId);
  if (error) return { error: "שגיאה בעדכון המסלול" };
  revalidatePlanSurfaces(plan.profile_id);
  return { success: true };
}

export async function cancelPlanAction(input: { planId: string }): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = cancelPlanSchema.safeParse(input);
  if (!parsed.success) return { error: "מזהה לא תקין" };

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("branch_id")
    .eq("id", parsed.data.planId)
    .maybeSingle()) as { data: { branch_id: string } | null };
  if (!plan) return { error: "המסלול לא נמצא" };
  const denied = await verifyAdminOrBranchManager([plan.branch_id]);
  if (denied) return { error: denied };

  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "המסלול לא נמצא" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}
