import { describe, expect, it } from "vitest";
import {
  bookingClosed,
  cancelState,
  isWithinBookingWindow,
  minutesUntilSlot,
  weekBounds,
  weeklyBookingCount,
  type RosterRowLite,
} from "../booking-rules";

const row = (overrides: Partial<RosterRowLite>): RosterRowLite => ({
  schedule_date: "2026-09-13",
  start_time: "16:00:00",
  branch_id: "ka",
  cancelled_at: null,
  late_cancel: false,
  ...overrides,
});

describe("weekBounds", () => {
  it("runs Sunday to Saturday around any day, across a month edge", () => {
    expect(weekBounds("2026-09-13")).toEqual({ start: "2026-09-13", end: "2026-09-19" });
    expect(weekBounds("2026-09-16")).toEqual({ start: "2026-09-13", end: "2026-09-19" });
    expect(weekBounds("2026-10-01")).toEqual({ start: "2026-09-27", end: "2026-10-03" });
  });
});

describe("window and cutoffs", () => {
  it("allows today through fourteen days ahead", () => {
    expect(isWithinBookingWindow("2026-09-11", "2026-09-11")).toBe(true);
    expect(isWithinBookingWindow("2026-09-25", "2026-09-11")).toBe(true);
    expect(isWithinBookingWindow("2026-09-26", "2026-09-11")).toBe(false);
    expect(isWithinBookingWindow("2026-09-10", "2026-09-11")).toBe(false);
  });

  it("measures minutes until a slot across days", () => {
    expect(minutesUntilSlot("2026-09-12", "16:00:00", { date: "2026-09-11", minutes: 15 * 60 })).toBe(25 * 60);
    expect(minutesUntilSlot("2026-09-11", "16:00", { date: "2026-09-11", minutes: 16 * 60 + 30 })).toBe(-30);
  });

  it("closes booking an hour before and grades cancels at three hours", () => {
    const at = (h: number, m = 0) => ({ date: "2026-09-11", minutes: h * 60 + m });
    expect(bookingClosed("2026-09-11", "16:00", at(14, 59))).toBe(false);
    expect(bookingClosed("2026-09-11", "16:00", at(15, 0))).toBe(true);
    expect(cancelState("2026-09-11", "16:00", at(12, 59))).toBe("open");
    expect(cancelState("2026-09-11", "16:00", at(13, 0))).toBe("late");
    expect(cancelState("2026-09-11", "16:00", at(16, 0))).toBe("closed");
  });
});

describe("weeklyBookingCount", () => {
  it("counts staff and self rows in the week, ignores cancelled unless late", () => {
    const rows = [
      row({ schedule_date: "2026-09-13" }),
      row({ schedule_date: "2026-09-15", cancelled_at: "2026-09-14T10:00:00Z" }),
      row({ schedule_date: "2026-09-16", cancelled_at: "2026-09-16T12:00:00Z", late_cancel: true }),
      row({ schedule_date: "2026-09-20" }),
      row({ schedule_date: "2026-09-14", branch_id: "haifa" }),
    ];
    expect(weeklyBookingCount(rows, "2026-09-17", "ka")).toBe(2);
  });
});
