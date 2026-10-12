/**
 * The income report: which money came in on which Israel day, how it split,
 * and who holds it. Pure: the loader fetches a slightly wider window and this
 * decides every day, every total and every exclusion, so the rules are tested
 * here and nowhere else. Spec: docs/superpowers/specs/2026-10-12-financial-reports-phase-1-design.md
 */
import { addDays, daysBetween } from "@/lib/utils/iso-date";
import { israelDateStr } from "@/lib/utils/israel-time";
import { ARBOX_PLACEHOLDER_ILS } from "@/lib/plans/arbox-import-plan";
import type { RefundMethod } from "@/lib/validations/plans-admin";
import type { OrderStatus, PaymentMethod } from "@/types/plans";

/** A sale counts on the day it was paid even if it was later voided or refunded. */
export const COUNTED_STATUSES: readonly OrderStatus[] = ["paid", "refunded", "voided"];
export const INCOME_METHODS = ["cash", "card", "bit", "transfer", "free"] as const;
export type IncomeMethod = (typeof INCOME_METHODS)[number];

export interface StaffRef {
  id: string;
  name: string;
}

/** A staff payment whose staff member was deleted (received_by is ON DELETE SET NULL). */
export const UNKNOWN_STAFF: StaffRef = { id: "unknown", name: "לא ידוע" };

const HAND_METHODS: readonly PaymentMethod[] = ["cash", "bit", "transfer", "free"];

export interface IncomeOrderRow {
  id: string;
  status: OrderStatus;
  /** ISO timestamp the money arrived. */
  paidAt: string;
  amountIls: number;
  method: PaymentMethod | null;
  installments: number;
  listPriceIls: number | null;
  discountReason: string | null;
  reference: string | null;
  receivedBy: StaffRef | null;
  paymentLinkBy: StaffRef | null;
  childName: string;
  parentName: string;
  planName: string;
  branchId: string;
  branchName: string;
  receiptUrl: string | null;
  /** The Arbox purchase day; null for app sales and hand-entered Arbox repairs. */
  arboxPurchasedOn: string | null;
}

export interface IncomeRefundRow {
  id: string;
  createdAt: string;
  amountIls: number;
  method: RefundMethod;
  kind: "void" | "cancellation";
  createdBy: StaffRef;
  childName: string;
  planName: string;
  branchId: string;
  creditNoteNumber: string | null;
  /** When the refunded sale was paid; null when the Plan had no order. */
  salePaidAt: string | null;
}

export type Collector =
  | { kind: "staff"; staff: StaffRef }
  | { kind: "link"; staff: StaffRef }
  | { kind: "online" };

export interface IncomePayment extends IncomeOrderRow {
  day: string;
  collector: Collector;
  incomeMethod: IncomeMethod;
}

export interface IncomeRefund extends IncomeRefundRow {
  day: string;
}

export interface ArboxEntry extends IncomeOrderRow {
  day: string;
  unknownAmount: boolean;
}

export interface DayTotal {
  day: string;
  received: number;
  refunds: number;
  net: number;
  count: number;
}

export interface MethodTotal {
  method: IncomeMethod;
  total: number;
  count: number;
}

export interface BranchTotal {
  branchId: string;
  branchName: string;
  total: number;
  count: number;
}

export interface StaffCashUp {
  staff: StaffRef;
  cash: number;
  bit: number;
  transfer: number;
  /** Cash refunds this person recorded and paid out. */
  cashRefundsOut: number;
  /** cash + bit + transfer - cashRefundsOut: what they should account for. */
  inHand: number;
  /** Card links they sent that were paid: listed, never added. */
  linksSent: { childName: string; amountIls: number }[];
  freeGiven: number;
}

export interface IncomeReport {
  from: string;
  to: string;
  received: number;
  refunds: number;
  net: number;
  installmentsIls: number;
  days: DayTotal[];
  byMethod: MethodTotal[];
  byBranch: BranchTotal[];
  staff: StaffCashUp[];
  payments: IncomePayment[];
  refundRows: IncomeRefund[];
  arbox: { entries: ArboxEntry[]; total: number; unknownCount: number; undoneCount: number };
}

export interface IncomeInput {
  from: string;
  to: string;
  orders: readonly IncomeOrderRow[];
  refunds: readonly IncomeRefundRow[];
}

/** Sums money without floating-point drift: numeric(10,2) amounts stay exact. */
const sum = (amounts: readonly number[]): number =>
  Math.round(amounts.reduce((total, amount) => total + amount, 0) * 100) / 100;

const dayList = (from: string, to: string): string[] =>
  Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));

export function collectorOf(o: Pick<IncomeOrderRow, "receivedBy" | "paymentLinkBy" | "method">): Collector {
  if (o.receivedBy) return { kind: "staff", staff: o.receivedBy };
  if (o.paymentLinkBy) return { kind: "link", staff: o.paymentLinkBy };
  if (o.method !== null && HAND_METHODS.includes(o.method)) return { kind: "staff", staff: UNKNOWN_STAFF };
  return { kind: "online" };
}

/** Legacy Morning-hosted orders carry no method; they were card payments. */
const incomeMethodOf = (o: IncomeOrderRow): IncomeMethod => (o.method ?? "card") as IncomeMethod;

function staffCashUp(payments: readonly IncomePayment[], refunds: readonly IncomeRefund[]): StaffCashUp[] {
  const people = new Map<string, StaffRef>([
    ...payments.flatMap((p): [string, StaffRef][] =>
      p.collector.kind === "online" ? [] : [[p.collector.staff.id, p.collector.staff]],
    ),
    ...refunds.filter((r) => r.method === "cash").map((r): [string, StaffRef] => [r.createdBy.id, r.createdBy]),
  ]);

  return [...people.values()]
    .map((staff) => {
      const own = payments.filter((p) => p.collector.kind === "staff" && p.collector.staff.id === staff.id);
      const links = payments.filter((p) => p.collector.kind === "link" && p.collector.staff.id === staff.id);
      const by = (method: IncomeMethod) => sum(own.filter((p) => p.incomeMethod === method).map((p) => p.amountIls));
      const cash = by("cash");
      const bit = by("bit");
      const transfer = by("transfer");
      const cashRefundsOut = sum(
        refunds.filter((r) => r.method === "cash" && r.createdBy.id === staff.id).map((r) => r.amountIls),
      );
      return {
        staff,
        cash,
        bit,
        transfer,
        cashRefundsOut,
        inHand: sum([cash, bit, transfer, -cashRefundsOut]),
        linksSent: links.map((p) => ({ childName: p.childName, amountIls: p.amountIls })),
        freeGiven: own.filter((p) => p.incomeMethod === "free").length,
      };
    })
    .sort((a, b) => b.inHand - a.inHand);
}

export function buildIncomeReport({ from, to, orders, refunds }: IncomeInput): IncomeReport {
  const inRange = (day: string) => day >= from && day <= to;
  const counted = orders.filter((o) => COUNTED_STATUSES.includes(o.status));

  const allPayments: IncomePayment[] = counted
    .filter((o) => o.method !== "arbox")
    .map((o) => ({ ...o, day: israelDateStr(o.paidAt), collector: collectorOf(o), incomeMethod: incomeMethodOf(o) }));
  // A refund paid back through Arbox is Arbox money, so it stays out of the app totals like the sale did.
  const allRefunds: IncomeRefund[] = refunds
    .filter((r) => r.method !== "arbox")
    .map((r) => ({ ...r, day: israelDateStr(r.createdAt) }));

  const payments = allPayments.filter((p) => inRange(p.day)).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const refundRows = allRefunds.filter((r) => inRange(r.day)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const arboxEntries: ArboxEntry[] = counted
    .filter((o) => o.method === "arbox")
    .map((o) => ({
      ...o,
      day: o.arboxPurchasedOn ?? israelDateStr(o.paidAt),
      unknownAmount: o.amountIls === ARBOX_PLACEHOLDER_ILS,
    }))
    .filter((e) => inRange(e.day))
    .sort((a, b) => a.day.localeCompare(b.day));

  const received = sum(payments.map((p) => p.amountIls));
  const refunded = sum(refundRows.map((r) => r.amountIls));

  const byMethod = INCOME_METHODS.map((method) => {
    const rows = payments.filter((p) => p.incomeMethod === method);
    return { method, total: sum(rows.map((p) => p.amountIls)), count: rows.length };
  }).filter((m) => m.count > 0);

  const branchIds = [...new Set(payments.map((p) => p.branchId))];
  const byBranch = branchIds
    .map((branchId) => {
      const rows = payments.filter((p) => p.branchId === branchId);
      return { branchId, branchName: rows[0].branchName, total: sum(rows.map((p) => p.amountIls)), count: rows.length };
    })
    .sort((a, b) => b.total - a.total);

  const days = dayList(from, to).map((day) => {
    const dayPayments = allPayments.filter((p) => p.day === day);
    const dayReceived = sum(dayPayments.map((p) => p.amountIls));
    const dayRefunds = sum(allRefunds.filter((r) => r.day === day).map((r) => r.amountIls));
    return { day, received: dayReceived, refunds: dayRefunds, net: sum([dayReceived, -dayRefunds]), count: dayPayments.length };
  });

  return {
    from,
    to,
    received,
    refunds: refunded,
    net: sum([received, -refunded]),
    installmentsIls: sum(payments.filter((p) => p.incomeMethod === "card" && p.installments > 1).map((p) => p.amountIls)),
    days,
    byMethod,
    byBranch,
    staff: staffCashUp(payments, refundRows),
    payments,
    refundRows,
    arbox: {
      entries: arboxEntries,
      total: sum(arboxEntries.filter((e) => e.status === "paid" && !e.unknownAmount).map((e) => e.amountIls)),
      unknownCount: arboxEntries.filter((e) => e.unknownAmount).length,
      undoneCount: arboxEntries.filter((e) => e.status !== "paid").length,
    },
  };
}
