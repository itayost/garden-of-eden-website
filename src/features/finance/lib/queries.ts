import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import { orderPlanName } from "@/lib/plans/manual-card";
import { loadPlanQueues, type PlanQueueView } from "@/features/plans/lib/queries";
import type { BranchOption } from "@/types/branches";
import type { OrderStatus, PaymentMethod } from "@/types/plans";
import {
  buildIncomeReport,
  COUNTED_STATUSES,
  type IncomeOrderRow,
  type IncomeRefundRow,
  type IncomeReport,
  type RefundMethod,
  type StaffRef,
} from "./income";
import { splitEnding, type EndingInput, type EndingSplit } from "./ending-soon";
import { stripStart, type ReportRange } from "./range";

export type FinanceResult<T> = { success: true; data: T } | { success: false; error: string };

const NO_ACCESS = "אין הרשאה לדוחות הכספיים";
const LOAD_FAILED = "לא הצלחנו לטעון את הדוח. נסו לרענן את הדף";

export interface FinanceBranches {
  /** Branches that sell in the app: an active product or any counted order. */
  selling: BranchOption[];
  /** Active branches that do not (today חיפה, which runs on Arbox). */
  notSelling: BranchOption[];
}

export async function loadFinanceBranches(): Promise<FinanceBranches> {
  const { error } = await verifyAdmin();
  if (error) return { selling: [], notSelling: [] };
  const db = createAdminClient();
  const { data: branches } = (await typedFrom(db, "branches")
    .select("id, name_he")
    .eq("is_active", true)
    .order("order_index")) as { data: { id: string; name_he: string }[] | null };

  const sells = await Promise.all(
    (branches ?? []).map(async (b) => {
      const [products, orders] = await Promise.all([
        typedFrom(db, "plan_products").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("is_active", true),
        typedFrom(db, "orders").select("id", { count: "exact", head: true }).eq("branch_id", b.id).in("status", [...COUNTED_STATUSES]),
      ]);
      return (products.count ?? 0) + (orders.count ?? 0) > 0;
    }),
  );
  const options = (branches ?? []).map((b) => ({ id: b.id, nameHe: b.name_he }));
  return {
    selling: options.filter((_, i) => sells[i]),
    notSelling: options.filter((_, i) => !sells[i]),
  };
}

const ORDER_SELECT =
  "id, status, paid_at, amount_ils, payment_method, installments, list_price_ils, discount_reason, reference, child_name, parent_name, profile_id, branch_id, morning_document_url, arbox_purchased_on, terms_sessions_total, terms_duration_days, product:plan_products(name_he), branch:branches(name_he), receiver:profiles!orders_received_by_fkey(id, full_name), linker:profiles!orders_payment_link_by_fkey(id, full_name)";

interface OrderSelectRow {
  id: string;
  status: OrderStatus;
  paid_at: string | null;
  amount_ils: number | string;
  payment_method: PaymentMethod | null;
  installments: number;
  list_price_ils: number | string | null;
  discount_reason: string | null;
  reference: string | null;
  child_name: string;
  parent_name: string;
  profile_id: string | null;
  branch_id: string;
  morning_document_url: string | null;
  arbox_purchased_on: string | null;
  terms_sessions_total: number | null;
  terms_duration_days: number | null;
  product: { name_he: string } | null;
  branch: { name_he: string } | null;
  receiver: { id: string; full_name: string | null } | null;
  linker: { id: string; full_name: string | null } | null;
}

const REFUND_SELECT =
  "id, created_at, amount_ils, method, kind, credit_note_number, creator:profiles!plan_refunds_created_by_fkey(id, full_name), plan:trainee_plans!plan_refunds_plan_id_fkey(branch_id, product:plan_products(name_he), trainee:profiles!trainee_plans_profile_id_fkey(full_name)), order:orders!plan_refunds_order_id_fkey(child_name, paid_at)";

interface RefundSelectRow {
  id: string;
  created_at: string;
  amount_ils: number | string;
  method: RefundMethod;
  kind: "void" | "cancellation";
  credit_note_number: string | null;
  creator: { id: string; full_name: string | null } | null;
  plan: { branch_id: string; product: { name_he: string } | null; trainee: { full_name: string | null } | null } | null;
  order: { child_name: string; paid_at: string | null } | null;
}

const staffRef = (p: { id: string; full_name: string | null } | null): StaffRef | null =>
  p ? { id: p.id, name: p.full_name ?? "לא ידוע" } : null;

function toOrderRow(o: OrderSelectRow): IncomeOrderRow {
  return {
    id: o.id,
    status: o.status,
    paidAt: o.paid_at as string,
    amountIls: Number(o.amount_ils),
    method: o.payment_method,
    installments: o.installments,
    listPriceIls: o.list_price_ils === null ? null : Number(o.list_price_ils),
    discountReason: o.discount_reason,
    reference: o.reference,
    receivedBy: staffRef(o.receiver),
    paymentLinkBy: staffRef(o.linker),
    childName: o.child_name,
    parentName: o.parent_name,
    profileId: o.profile_id,
    planName: orderPlanName(o.product?.name_he ?? "מסלול", o),
    branchId: o.branch_id,
    branchName: o.branch?.name_he ?? "",
    receiptUrl: o.morning_document_url,
    arboxPurchasedOn: o.arbox_purchased_on,
  };
}

function toRefundRow(r: RefundSelectRow): IncomeRefundRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    amountIls: Number(r.amount_ils),
    method: r.method,
    kind: r.kind,
    createdBy: staffRef(r.creator) ?? { id: "unknown", name: "לא ידוע" },
    childName: r.order?.child_name ?? r.plan?.trainee?.full_name ?? "",
    planName: r.plan?.product?.name_he ?? "מסלול",
    branchId: r.plan?.branch_id ?? "",
    creditNoteNumber: r.credit_note_number,
    salePaidAt: r.order?.paid_at ?? null,
  };
}

export async function loadIncomeReport(
  range: ReportRange,
  branchId: string | null,
): Promise<FinanceResult<IncomeReport>> {
  const { error } = await verifyAdmin();
  if (error) return { success: false, error: NO_ACCESS };

  try {
    const db = createAdminClient();
    const stripFrom = stripStart(range);
    // One day wider on each side: the pure report assigns Israel days.
    const fromIso = `${addDays(stripFrom, -1)}T00:00:00Z`;
    const toIso = `${addDays(range.to, 2)}T00:00:00Z`;

    const paidBase = typedFrom(db, "orders").select(ORDER_SELECT);
    const arboxBase = typedFrom(db, "orders").select(ORDER_SELECT);
    const [byPaidAt, arboxByDay, refunds] = await Promise.all([
      (branchId ? paidBase.eq("branch_id", branchId) : paidBase)
        .in("status", [...COUNTED_STATUSES])
        .gte("paid_at", fromIso)
        .lt("paid_at", toIso),
      // An Arbox purchase can be imported days after it happened.
      (branchId ? arboxBase.eq("branch_id", branchId) : arboxBase)
        .in("status", [...COUNTED_STATUSES])
        .eq("payment_method", "arbox")
        .gte("arbox_purchased_on", range.from)
        .lte("arbox_purchased_on", range.to),
      typedFrom(db, "plan_refunds").select(REFUND_SELECT).gte("created_at", fromIso).lt("created_at", toIso),
    ]);
    if (byPaidAt.error || arboxByDay.error || refunds.error) {
      console.error("loadIncomeReport error:", byPaidAt.error ?? arboxByDay.error ?? refunds.error);
      return { success: false, error: LOAD_FAILED };
    }

    const orderRows = [...((byPaidAt.data ?? []) as OrderSelectRow[]), ...((arboxByDay.data ?? []) as OrderSelectRow[])];
    const uniqueOrders = [...new Map(orderRows.map((o) => [o.id, o])).values()].filter((o) => o.paid_at !== null);
    const refundRows = ((refunds.data ?? []) as RefundSelectRow[])
      .map(toRefundRow)
      .filter((r) => !branchId || r.branchId === branchId);

    return {
      success: true,
      data: buildIncomeReport({
        from: range.from,
        to: range.to,
        stripFrom,
        orders: uniqueOrders.map(toOrderRow),
        refunds: refundRows,
      }),
    };
  } catch (err) {
    console.error("loadIncomeReport failed:", err);
    return { success: false, error: LOAD_FAILED };
  }
}

export interface EndingRow extends EndingInput {
  traineeName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  branchId: string;
  branchName: string;
  planName: string;
  /** "מוקפא עד 20.10" or "מוקפא" for an open freeze; null when not frozen. */
  frozenLabel: string | null;
}

const REMINDER_STAMPS = ["reminded_3_days_at", "reminded_last_session_at", "reminded_expired_at"] as const;

function toEndingInput(profileId: string, view: PlanQueueView, linkWaiting: boolean): EndingInput {
  const last = view.queue.plans.at(-1)?.plan ?? view.plan;
  return {
    profileId,
    status: view.status,
    endsOn: view.endsOn,
    sessionsLeft: view.sessionsLeft,
    cardsOnly: view.queue.cardsOnly,
    booked: view.queue.ahead.reduce((total, p) => total + p.booked, 0),
    reminded: REMINDER_STAMPS.some((stamp) => last[stamp] !== null),
    linkWaiting,
    frozen: view.queue.frozen ? { endsOn: view.queue.frozen.endsOn } : null,
    paidInArbox: last.paidInArbox,
  };
}

/** Every Trainee with a sold Plan, as ending-soon inputs. No auth check: callers gate. */
export async function loadEndingInputs(db: SupabaseClient, branchId: string | null): Promise<EndingRow[]> {
  const planQuery = typedFrom(db, "trainee_plans").select("profile_id").neq("status", "voided");
  const { data: planRows } = (await (branchId ? planQuery.eq("branch_id", branchId) : planQuery)) as {
    data: { profile_id: string }[] | null;
  };
  const ids = [...new Set((planRows ?? []).map((r) => r.profile_id))];
  if (ids.length === 0) return [];

  const today = israelToday();
  const [queues, { data: profiles }, { data: links }, { data: branches }] = await Promise.all([
    loadPlanQueues(db, ids, today),
    typedFrom(db, "profiles").select("id, full_name, guardian_name, guardian_phone").in("id", ids),
    typedFrom(db, "orders").select("profile_id").in("status", ["pending", "expired"]).in("profile_id", ids),
    typedFrom(db, "branches").select("id, name_he"),
  ]);
  const profileById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; guardian_name: string | null; guardian_phone: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const waiting = new Set(((links ?? []) as { profile_id: string | null }[]).map((l) => l.profile_id));
  const branchName = new Map(((branches ?? []) as { id: string; name_he: string }[]).map((b) => [b.id, b.name_he]));

  return [...queues].map(([profileId, view]) => {
    const profile = profileById.get(profileId);
    const input = toEndingInput(profileId, view, waiting.has(profileId));
    const freezeEnd = input.frozen?.endsOn;
    return {
      ...input,
      traineeName: profile?.full_name ?? "ללא שם",
      guardianName: profile?.guardian_name ?? null,
      guardianPhone: profile?.guardian_phone ?? null,
      branchId: view.plan.branch_id,
      branchName: branchName.get(view.plan.branch_id) ?? "",
      planName: view.product.name_he,
      frozenLabel: input.frozen
        ? freezeEnd
          ? `מוקפא עד ${Number(freezeEnd.slice(8, 10))}.${Number(freezeEnd.slice(5, 7))}`
          : "מוקפא"
        : null,
    };
  });
}

export async function loadEndingSoon(branchId: string | null): Promise<FinanceResult<EndingSplit<EndingRow>>> {
  const { error } = await verifyAdmin();
  if (error) return { success: false, error: NO_ACCESS };
  try {
    const rows = await loadEndingInputs(createAdminClient(), branchId);
    return { success: true, data: splitEnding(rows, israelToday()) };
  } catch (err) {
    console.error("loadEndingSoon failed:", err);
    return { success: false, error: LOAD_FAILED };
  }
}
