import { describe, expect, test } from "vitest";

import { planRosterAdd, planRosterRemove } from "../roster-entry";
import type { SlotTrainee } from "@/types/schedule";

const NOAM = "33333333-3333-4333-8333-333333333333";
const OMER = "44444444-4444-4444-8444-444444444444";

function entry(overrides: Partial<SlotTrainee> = {}): SlotTrainee {
  return {
    id: "entry-1",
    slot_id: "slot-1",
    trainee_id: NOAM,
    trainee_name: "נועם",
    order_index: 0,
    source: "staff",
    booked_at: null,
    cancelled_at: null,
    late_cancel: false,
    reminded_at: null,
    ...overrides,
  };
}

describe("planRosterAdd", () => {
  test("inserts a new linked trainee after the highest order_index", () => {
    const roster = [entry({ id: "a", order_index: 0 }), entry({ id: "b", trainee_id: null, trainee_name: "אורח", order_index: 4 })];
    expect(planRosterAdd(roster, { traineeId: OMER, name: "עומר" }, null)).toEqual({
      kind: "insert",
      orderIndex: 5,
      overCapacity: false,
    });
  });

  test("inserts at 0 into an empty roster", () => {
    expect(planRosterAdd([], { traineeId: OMER, name: "עומר" }, 8)).toEqual({
      kind: "insert",
      orderIndex: 0,
      overCapacity: false,
    });
  });

  test("rejects a linked trainee already active on the slot", () => {
    expect(planRosterAdd([entry()], { traineeId: NOAM, name: "נועם" }, null)).toEqual({
      kind: "reject",
      error: "המתאמן כבר רשום לסלוט",
    });
  });

  test("reinstates a cancelled row instead of inserting a duplicate", () => {
    const roster = [entry({ id: "cancelled", cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true })];
    expect(planRosterAdd(roster, { traineeId: NOAM, name: "נועם" }, null)).toEqual({
      kind: "reinstate",
      rowId: "cancelled",
      overCapacity: false,
    });
  });

  test("rejects a free-text name already active on the slot", () => {
    const roster = [entry({ trainee_id: null, trainee_name: "אורח" })];
    expect(planRosterAdd(roster, { traineeId: null, name: "אורח" }, null)).toEqual({
      kind: "reject",
      error: "השם כבר ברשימה",
    });
  });

  test("flags over capacity but still allows staff to add", () => {
    const roster = [entry({ id: "a" }), entry({ id: "b", trainee_id: OMER, order_index: 1 })];
    expect(planRosterAdd(roster, { traineeId: null, name: "אורח" }, 2)).toEqual({
      kind: "insert",
      orderIndex: 2,
      overCapacity: true,
    });
  });

  test("cancelled rows do not count toward capacity", () => {
    const roster = [entry({ id: "a", cancelled_at: "2026-09-15T10:00:00Z" })];
    const plan = planRosterAdd(roster, { traineeId: OMER, name: "עומר" }, 1);
    expect(plan).toEqual({ kind: "insert", orderIndex: 1, overCapacity: false });
  });
});

describe("planRosterRemove", () => {
  test("allows removing an active entry", () => {
    expect(planRosterRemove(entry())).toBeNull();
  });

  test("refuses a cancelled entry so usage history stays", () => {
    expect(planRosterRemove(entry({ cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true }))).toBe(
      "ביטול שכבר נרשם נשמר בהיסטוריה ואינו ניתן להסרה",
    );
  });
});
