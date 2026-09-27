import { describe, expect, test } from "vitest";

import {
  purchaseKindOf,
  purchasesFromReports,
  type MembershipsReportRow,
  type SalesReportRow,
  type SessionsReportRow,
} from "../purchase-rows";

function card(overrides: Partial<SessionsReportRow> = {}): SessionsReportRow {
  return {
    user_id: 100,
    membership_type_name: "כרטיסייה",
    purchase_date: "2026-09-22",
    start_date: "2026-09-22",
    end_date: "2026-12-21",
    sessions_left: 9,
    paid: 1000,
    status: "active",
    ...overrides,
  };
}

function sale(overrides: Partial<SalesReportRow> = {}): SalesReportRow {
  return {
    user_id: 100,
    item_name: "כרטיסייה",
    item_type: "session",
    membership_user_id: 5001,
    start_date: "2026-09-22",
    status: "active",
    ...overrides,
  };
}

function membership(overrides: Partial<MembershipsReportRow> = {}): MembershipsReportRow {
  return {
    user_id: 200,
    membership_type_name: "מנוי מתקדמים 4 חודשים",
    membership_user_id: 7001,
    purchase_date: "2026-09-02",
    start_date: "2026-09-02",
    end_date: "2027-01-01",
    paid: 3200,
    status: "active",
    ...overrides,
  };
}

describe("purchaseKindOf", () => {
  test("classifies cards and memberships", () => {
    expect(purchaseKindOf("כרטיסייה")).toBe("card");
    expect(purchaseKindOf("כרטיסית פרימיום קריות")).toBe("card");
    expect(purchaseKindOf("מנוי מתקדמים חודש")).toBe("membership");
  });

  test("excludes camps, mistakes, and anything else", () => {
    expect(purchaseKindOf("מחנה קיץ - הכנה לעונה")).toBe(null);
    expect(purchaseKindOf("מחנה סוכות")).toBe(null);
    expect(purchaseKindOf("מנוי מתקדמים 4 חודשים - טעות")).toBe(null);
    expect(purchaseKindOf("קורס דיגיטלי")).toBe(null);
    expect(purchaseKindOf(null)).toBe(null);
  });
});

describe("purchasesFromReports", () => {
  test("keys a card by its single matching sale", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale()],
    });

    expect(unmatchedCards).toEqual([]);
    expect(purchases).toEqual([
      {
        membershipUserId: 5001,
        userId: 100,
        kind: "card",
        itemName: "כרטיסייה",
        purchaseDate: "2026-09-22",
        startDate: "2026-09-22",
        endDate: "2026-12-21",
        sessionsLeft: 9,
        paid: 1000,
        status: "active",
      },
    ]);
  });

  test("reports a card with no matching sale instead of guessing", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card({ start_date: "2025-12-30", purchase_date: "2025-12-30" })],
      memberships: [],
      sales: [sale()],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards).toEqual([
      { userId: 100, itemName: "כרטיסייה", startDate: "2025-12-30", matches: 0 },
    ]);
  });

  test("reports a card that matches two sales", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale(), sale({ membership_user_id: 5002 })],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards[0].matches).toBe(2);
  });

  test("ignores sales that are not active sessions", () => {
    const { purchases } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale({ status: "inactive" }), sale({ item_type: "plan", membership_user_id: 5003 })],
    });

    expect(purchases).toEqual([]);
  });

  test("two identical card rows sharing one sale are both unmatched", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card(), card({ sessions_left: 10 })],
      memberships: [],
      sales: [sale()],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards).toHaveLength(2);
  });

  test("parses numbers Arbox sends as strings", () => {
    const { purchases } = purchasesFromReports({
      cards: [card({ user_id: "100", sessions_left: "4", paid: "2250" })],
      memberships: [],
      sales: [sale({ user_id: "100", membership_user_id: "5001" })],
    });

    expect(purchases[0]).toMatchObject({ userId: 100, sessionsLeft: 4, paid: 2250, membershipUserId: 5001 });
  });

  test("takes memberships with their own id", () => {
    const { purchases } = purchasesFromReports({ cards: [], memberships: [membership()], sales: [] });

    expect(purchases).toEqual([
      {
        membershipUserId: 7001,
        userId: 200,
        kind: "membership",
        itemName: "מנוי מתקדמים 4 חודשים",
        purchaseDate: "2026-09-02",
        startDate: "2026-09-02",
        endDate: "2027-01-01",
        sessionsLeft: null,
        paid: 3200,
        status: "active",
      },
    ]);
  });

  test("drops camps and rows without an id or start date", () => {
    const { purchases } = purchasesFromReports({
      cards: [card({ membership_type_name: "מחנה סוכות" })],
      memberships: [
        membership({ membership_user_id: null }),
        membership({ start_date: null, membership_user_id: 7002 }),
      ],
      sales: [sale({ item_name: "מחנה סוכות" })],
    });

    expect(purchases).toEqual([]);
  });

  test("falls back to the start date when the purchase date is missing", () => {
    const { purchases } = purchasesFromReports({
      cards: [],
      memberships: [membership({ purchase_date: null })],
      sales: [],
    });

    expect(purchases[0].purchaseDate).toBe("2026-09-02");
  });
});
