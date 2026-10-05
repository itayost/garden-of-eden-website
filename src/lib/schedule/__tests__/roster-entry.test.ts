import { describe, expect, it, test } from "vitest";

import { callOffRefusal, mayCorrectPastSlot, pastSlotEditRefusal, planRosterAdd, planRosterRemove, rosterRemovalMode } from "../roster-entry";
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

describe("rosterRemovalMode", () => {
  const now = { date: "2026-10-05", minutes: 17 * 60 };

  it("deletes an entry from a Slot that has not started, as before", () => {
    expect(rosterRemovalMode({ schedule_date: "2026-10-06", start_time: "16:00:00" }, now)).toBe("delete");
    expect(rosterRemovalMode({ schedule_date: "2026-10-05", start_time: "18:00:00" }, now)).toBe("delete");
  });

  it("records the removal from a Slot that already started", () => {
    expect(rosterRemovalMode({ schedule_date: "2026-10-05", start_time: "16:30:00" }, now)).toBe("record");
    expect(rosterRemovalMode({ schedule_date: "2026-10-01", start_time: "16:00:00" }, now)).toBe("record");
  });
});

describe("mayCorrectPastSlot", () => {
  it("lets a trainer correct only Slots they ran; Admins and Branch managers any in scope", () => {
    const slot = { trainerIds: ["t1", "t2"] };

    expect(mayCorrectPastSlot({ role: "trainer", userId: "t1", managesBranch: false }, slot)).toBe(true);
    expect(mayCorrectPastSlot({ role: "trainer", userId: "t9", managesBranch: false }, slot)).toBe(false);
    expect(mayCorrectPastSlot({ role: "trainer", userId: "t9", managesBranch: true }, slot)).toBe(true);
    expect(mayCorrectPastSlot({ role: "admin", userId: "a1", managesBranch: false }, slot)).toBe(true);
  });
});

describe("callOffRefusal", () => {
  const now = { date: "2026-10-05", minutes: 17 * 60 };

  it("only a Slot that already started can be called off", () => {
    expect(callOffRefusal({ schedule_date: "2026-10-05", start_time: "18:00:00" }, now)).toBe(
      "אפשר לסמן כבוטל רק אימון שמועד תחילתו עבר",
    );
    expect(callOffRefusal({ schedule_date: "2026-10-04", start_time: "18:00:00" }, now)).toBeNull();
  });
});

describe("pastSlotEditRefusal", () => {
  const now = { date: "2026-10-05", minutes: 17 * 60 };
  const past = { schedule_date: "2026-10-04", start_time: "16:00:00", called_off_at: null };
  const future = { schedule_date: "2026-10-07", start_time: "16:00:00", called_off_at: null };

  it("lets a Slot that has not started be edited freely, roster included", () => {
    expect(pastSlotEditRefusal(future, { scheduleDate: "2026-10-08", startTime: "17:00" }, true, now)).toBeNull();
  });

  it("corrects a past Slot's roster only from the roster sheet, where removals are recorded", () => {
    expect(pastSlotEditRefusal(past, { scheduleDate: "2026-10-04", startTime: "16:00" }, true, now)).toBe(
      "את רשימת המתאמנים של אימון שכבר התקיים מתקנים מחלון הרשימה",
    );
    expect(pastSlotEditRefusal(past, { scheduleDate: "2026-10-04", startTime: "16:30" }, false, now)).toBeNull();
  });

  it("never moves a Slot that already started into the future", () => {
    expect(pastSlotEditRefusal(past, { scheduleDate: "2026-10-09", startTime: "16:00" }, false, now)).toBe(
      "אי אפשר להזיז אימון שכבר התקיים למועד עתידי",
    );
  });

  it("never moves a Called off Slot", () => {
    const calledOff = { ...past, called_off_at: "2026-10-04T20:00:00Z" };
    expect(pastSlotEditRefusal(calledOff, { scheduleDate: "2026-10-03", startTime: "16:00" }, false, now)).toBe(
      "אי אפשר להזיז אימון שסומן כבוטל. בטלו קודם את הסימון.",
    );
  });
});
