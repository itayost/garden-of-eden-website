import { describe, expect, test } from "vitest";
import {
  buildIncomeReport,
  collectorOf,
  UNKNOWN_STAFF,
  type IncomeOrderRow,
  type IncomeRefundRow,
} from "../income";

const YOAV = { id: "s-yoav", name: "יואב כהן" };
const NOA = { id: "s-noa", name: "נועה פרץ" };
const EDEN = { id: "s-eden", name: "עדן" };
const DAY = "2026-10-12";

function order(overrides: Partial<IncomeOrderRow> = {}): IncomeOrderRow {
  return {
    id: "o-1",
    status: "paid",
    paidAt: "2026-10-12T09:00:00Z",
    amountIls: 450,
    method: "cash",
    installments: 1,
    listPriceIls: null,
    discountReason: null,
    reference: null,
    receivedBy: YOAV,
    paymentLinkBy: null,
    childName: "אורי לוי",
    parentName: "מיכל לוי",
    planName: "מנוי חודשי",
    branchId: "ka",
    branchName: "קריית אתא",
    receiptUrl: "https://morning.example/doc/1",
    arboxPurchasedOn: null,
    ...overrides,
  };
}

function refund(overrides: Partial<IncomeRefundRow> = {}): IncomeRefundRow {
  return {
    id: "r-1",
    createdAt: "2026-10-12T15:00:00Z",
    amountIls: 310,
    method: "transfer",
    kind: "cancellation",
    createdBy: EDEN,
    childName: "תמר גולן",
    planName: "מנוי חודשי",
    branchId: "ka",
    creditNoteNumber: "40021",
    salePaidAt: "2026-09-28T08:00:00Z",
    ...overrides,
  };
}

const report = (
  orders: IncomeOrderRow[],
  refunds: IncomeRefundRow[] = [],
  from = DAY,
  to = DAY,
) => buildIncomeReport({ from, to, orders, refunds });

describe("Israel days", () => {
  test("23:30 in Israel stays on its day; 00:30 belongs to the next, in summer", () => {
    const late = order({ id: "late", paidAt: "2026-10-12T20:30:00Z" });
    const early = order({ id: "early", paidAt: "2026-10-12T21:30:00Z" });
    expect(report([late, early]).payments.map((p) => p.id)).toEqual(["late"]);
    expect(report([late, early], [], "2026-10-13", "2026-10-13").payments.map((p) => p.id)).toEqual(["early"]);
  });
  test("the same edges in winter", () => {
    const late = order({ id: "late", paidAt: "2026-12-01T21:30:00Z" });
    const early = order({ id: "early", paidAt: "2026-12-01T22:30:00Z" });
    expect(report([late, early], [], "2026-12-01", "2026-12-01").payments.map((p) => p.id)).toEqual(["late"]);
    expect(report([late, early], [], "2026-12-02", "2026-12-02").payments.map((p) => p.id)).toEqual(["early"]);
  });
  test("the night clocks go back still counts to the right day", () => {
    const night = order({ paidAt: "2026-10-24T21:30:00Z" });
    expect(report([night], [], "2026-10-25", "2026-10-25").payments).toHaveLength(1);
  });
});

describe("which orders count", () => {
  test("paid, refunded and voided count on the day they were paid", () => {
    const rows = [
      order({ id: "a", status: "paid" }),
      order({ id: "b", status: "refunded" }),
      order({ id: "c", status: "voided" }),
    ];
    expect(report(rows).received).toBe(1350);
    expect(report(rows).payments.map((p) => p.status)).toEqual(["paid", "refunded", "voided"]);
  });
  test("failed, pending, charging and expired never count", () => {
    const rows = (["failed", "pending", "charging", "expired"] as const).map((status, i) =>
      order({ id: `x${i}`, status }),
    );
    expect(report(rows).received).toBe(0);
    expect(report(rows).payments).toEqual([]);
  });
});

describe("refunds", () => {
  test("a refund subtracts on its own day, not the sale's", () => {
    const sale = order({ paidAt: "2026-10-10T09:00:00Z", amountIls: 450 });
    const back = refund({ createdAt: "2026-10-12T15:00:00Z", amountIls: 310 });
    const today = report([sale], [back]);
    expect(today.received).toBe(0);
    expect(today.refunds).toBe(310);
    expect(today.net).toBe(-310);
    expect(report([sale], [back], "2026-10-10", "2026-10-10").refunds).toBe(0);
  });
  test("refund without an order: kept, with no sale date", () => {
    const grant = refund({ salePaidAt: null, amountIls: 0, method: "none" });
    expect(report([], [grant]).refundRows).toHaveLength(1);
    expect(report([], [grant]).refundRows[0].salePaidAt).toBeNull();
  });
});

describe("Arbox", () => {
  test("never joins the app total and has its own", () => {
    const app = order({ amountIls: 450 });
    const arbox = order({ id: "ax", method: "arbox", receivedBy: null, amountIls: 1329, arboxPurchasedOn: DAY });
    const r = report([app, arbox]);
    expect(r.received).toBe(450);
    expect(r.payments.map((p) => p.id)).toEqual(["o-1"]);
    expect(r.arbox.total).toBe(1329);
    expect(r.arbox.entries.map((e) => e.id)).toEqual(["ax"]);
  });
  test("voided and refunded sales are listed but leave the Arbox total", () => {
    const paid = order({ id: "a1", method: "arbox", receivedBy: null, amountIls: 1000, arboxPurchasedOn: DAY });
    const voided = order({ id: "a2", method: "arbox", receivedBy: null, amountIls: 500, status: "voided", arboxPurchasedOn: DAY });
    const refunded = order({ id: "a3", method: "arbox", receivedBy: null, amountIls: 300, status: "refunded", arboxPurchasedOn: DAY });
    const r = report([paid, voided, refunded]);
    expect(r.arbox.entries.map((e) => e.id).sort()).toEqual(["a1", "a2", "a3"]);
    expect(r.arbox.total).toBe(1000);
    expect(r.arbox.undoneCount).toBe(2);
  });
  test("is dated by its purchase day even when imported later", () => {
    const arbox = order({ method: "arbox", receivedBy: null, paidAt: "2026-10-14T01:00:00Z", arboxPurchasedOn: DAY });
    expect(report([arbox]).arbox.entries).toHaveLength(1);
  });
  test("arbox repair with no purchase day falls back to the Israel day of paid_at", () => {
    const repair = order({ method: "arbox", receivedBy: EDEN, paidAt: "2026-10-12T20:30:00Z", arboxPurchasedOn: null });
    expect(report([repair]).arbox.entries.map((e) => e.day)).toEqual([DAY]);
  });
  test("a 1 ILS placeholder is listed, flagged, and left out of the Arbox total", () => {
    const known = order({ id: "k", method: "arbox", receivedBy: null, amountIls: 520, arboxPurchasedOn: DAY });
    const unknown = order({ id: "u", method: "arbox", receivedBy: null, amountIls: 1, arboxPurchasedOn: DAY });
    const r = report([known, unknown]);
    expect(r.arbox.total).toBe(520);
    expect(r.arbox.unknownCount).toBe(1);
    expect(r.arbox.entries.find((e) => e.id === "u")?.unknownAmount).toBe(true);
  });
});

describe("Arbox refunds", () => {
  test("a refund paid back through Arbox stays out of the app totals and the refund list", () => {
    const sale = order({ paidAt: "2026-10-12T09:00:00Z", amountIls: 450 });
    const back = refund({ method: "arbox", amountIls: 310 });
    const r = report([sale], [back]);
    expect(r.received).toBe(450);
    expect(r.refunds).toBe(0);
    expect(r.net).toBe(450);
    expect(r.refundRows).toEqual([]);
    expect(r.days[0]).toMatchObject({ refunds: 0, net: 450 });
  });
});

describe("methods, installments and free", () => {
  const rows = [
    order({ id: "cash", method: "cash", amountIls: 450 }),
    order({ id: "card12", method: "card", receivedBy: null, paymentLinkBy: NOA, amountIls: 1200, installments: 12 }),
    order({ id: "card3", method: "card", receivedBy: null, amountIls: 520, installments: 3 }),
    order({ id: "card1", method: "card", receivedBy: null, amountIls: 300, installments: 1 }),
    order({ id: "free", method: "free", amountIls: 0, listPriceIls: 520, discountReason: "מלגה", receivedBy: EDEN }),
  ];
  test("totals per method in a fixed order, skipping methods with nothing", () => {
    expect(report(rows).byMethod).toEqual([
      { method: "cash", total: 450, count: 1 },
      { method: "card", total: 2020, count: 3 },
      { method: "free", total: 0, count: 1 },
    ]);
  });
  test("card money split into installments is summed apart", () => {
    expect(report(rows).installmentsIls).toBe(1720);
  });
  test("free adds nothing but is counted", () => {
    expect(report(rows).received).toBe(2470);
  });
  test("a legacy Morning order with no method is a card payment", () => {
    expect(report([order({ method: null, receivedBy: null })]).byMethod[0].method).toBe("card");
  });
});

describe("branches", () => {
  test("totals per branch, largest first", () => {
    const rows = [
      order({ id: "a", branchId: "ka", branchName: "קריית אתא", amountIls: 450 }),
      order({ id: "b", branchId: "hf", branchName: "חיפה", amountIls: 900 }),
    ];
    expect(report(rows).byBranch).toEqual([
      { branchId: "hf", branchName: "חיפה", total: 900, count: 1 },
      { branchId: "ka", branchName: "קריית אתא", total: 450, count: 1 },
    ]);
  });
});

describe("who took it", () => {
  test("staff, link and online", () => {
    expect(collectorOf({ receivedBy: YOAV, paymentLinkBy: null, method: "cash" })).toEqual({ kind: "staff", staff: YOAV });
    expect(collectorOf({ receivedBy: null, paymentLinkBy: NOA, method: "card" })).toEqual({ kind: "link", staff: NOA });
    expect(collectorOf({ receivedBy: null, paymentLinkBy: null, method: "card" })).toEqual({ kind: "online" });
  });
  test("deleted staff: a hand payment stays a staff payment by an unknown person", () => {
    expect(collectorOf({ receivedBy: null, paymentLinkBy: null, method: "cash" })).toEqual({ kind: "staff", staff: UNKNOWN_STAFF });
  });
});

describe("cash-up per staff member", () => {
  const rows = [
    order({ id: "y1", method: "cash", amountIls: 450, receivedBy: YOAV }),
    order({ id: "y2", method: "bit", amountIls: 450, receivedBy: YOAV }),
    order({ id: "y3", method: "cash", amountIls: 520, receivedBy: YOAV, status: "voided" }),
    order({ id: "n1", method: "cash", amountIls: 380, receivedBy: NOA }),
    order({ id: "n2", method: "card", amountIls: 1200, receivedBy: null, paymentLinkBy: NOA, childName: "דניאל מזרחי" }),
    order({ id: "e1", method: "transfer", amountIls: 900, receivedBy: EDEN }),
    order({ id: "e2", method: "free", amountIls: 0, receivedBy: EDEN }),
  ];
  const refunds = [refund({ method: "cash", amountIls: 520, createdBy: EDEN })];

  test("each person's cash, Bit and transfer, minus cash refunds they paid out", () => {
    const staff = report(rows, refunds).staff;
    expect(staff.find((s) => s.staff.id === YOAV.id)).toMatchObject({ cash: 970, bit: 450, transfer: 0, cashRefundsOut: 0, inHand: 1420 });
    expect(staff.find((s) => s.staff.id === EDEN.id)).toMatchObject({ transfer: 900, cashRefundsOut: 520, inHand: 380, freeGiven: 1 });
  });
  test("card links are listed, never added to what they hold", () => {
    const noa = report(rows, refunds).staff.find((s) => s.staff.id === NOA.id);
    expect(noa?.inHand).toBe(380);
    expect(noa?.linksSent).toEqual([{ childName: "דניאל מזרחי", amountIls: 1200 }]);
  });
  test("an Arbox repair is not part of anyone's cash-up", () => {
    const repair = order({ id: "ar", method: "arbox", receivedBy: EDEN, amountIls: 1329, arboxPurchasedOn: DAY });
    const staff = report([repair, rows[0]]).staff;
    expect(staff.map((s) => s.staff.id)).toEqual([YOAV.id]);
  });
  test("a cash refund by someone with no payments in range still gets a row, in the red", () => {
    const staff = report([], [refund({ method: "cash", amountIls: 520, createdBy: NOA })]).staff;
    expect(staff).toHaveLength(1);
    expect(staff[0]).toMatchObject({ staff: NOA, cashRefundsOut: 520, inHand: -520 });
  });
  test("a cheque is in the hand of whoever took it, like cash", () => {
    const cheque = order({ id: "y4", method: "check", amountIls: 600, receivedBy: YOAV, reference: "1002" });
    const yoav = report([...rows, cheque], refunds).staff.find((s) => s.staff.id === YOAV.id);
    expect(yoav).toMatchObject({ cash: 970, bit: 450, check: 600, inHand: 2020 });
  });
  test("a cheque with no one recorded stays a staff payment, never online", () => {
    expect(collectorOf({ receivedBy: null, paymentLinkBy: null, method: "check" })).toEqual({ kind: "staff", staff: UNKNOWN_STAFF });
  });
  test("cheques have their own row in the per-method totals", () => {
    const cheque = order({ id: "c1", method: "check", amountIls: 600, receivedBy: YOAV });
    expect(report([rows[0], cheque]).byMethod).toEqual([
      { method: "cash", total: 450, count: 1 },
      { method: "check", total: 600, count: 1 },
    ]);
  });
  test("a refund by transfer does not touch anyone's cash", () => {
    const staff = report(rows, [refund({ method: "transfer", createdBy: EDEN })]).staff;
    expect(staff.find((s) => s.staff.id === EDEN.id)?.cashRefundsOut).toBe(0);
  });
});

describe("days", () => {
  test("one row per day of the range, each with only its own totals", () => {
    const rows = [
      order({ id: "a", paidAt: "2026-10-11T09:00:00Z", amountIls: 100 }),
      order({ id: "b", paidAt: "2026-10-12T09:00:00Z", amountIls: 450 }),
      order({ id: "outside", paidAt: "2026-10-09T09:00:00Z", amountIls: 999 }),
    ];
    const r = report(rows, [refund()], "2026-10-10", DAY);
    expect(r.days).toEqual([
      { day: "2026-10-10", received: 0, refunds: 0, net: 0, count: 0 },
      { day: "2026-10-11", received: 100, refunds: 0, net: 100, count: 1 },
      { day: "2026-10-12", received: 450, refunds: 310, net: 140, count: 1 },
    ]);
    expect(r.received).toBe(550);
  });
});

describe("an empty day", () => {
  test("zeros and empty lists, never undefined", () => {
    const r = report([]);
    expect(r).toMatchObject({ received: 0, refunds: 0, net: 0, installmentsIls: 0 });
    expect(r.byMethod).toEqual([]);
    expect(r.staff).toEqual([]);
    expect(r.arbox).toEqual({ entries: [], total: 0, unknownCount: 0, undoneCount: 0 });
    expect(r.days).toEqual([{ day: DAY, received: 0, refunds: 0, net: 0, count: 0 }]);
  });
});
