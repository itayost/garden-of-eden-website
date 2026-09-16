import { describe, expect, test } from "vitest";

import { findDay, resolveCalendarDate, visibleDays } from "../calendar";
import type { Week, WeekDay } from "@/lib/utils/schedule-week";

const TODAY = "2026-09-16";

function day(date: string, weekday: WeekDay["weekday"]): WeekDay {
  return {
    date,
    weekday,
    isToday: date === TODAY,
    isPast: date < TODAY,
    isBuilt: false,
    slots: [],
    onDuty: { bands: [], absences: [] } as unknown as WeekDay["onDuty"],
    extras: [],
  };
}

const SIX_DAYS = [
  day("2026-09-13", 0),
  day("2026-09-14", 1),
  day("2026-09-15", 2),
  day("2026-09-16", 3),
  day("2026-09-17", 4),
  day("2026-09-18", 5),
];

describe("resolveCalendarDate", () => {
  test("accepts a valid date inside the window", () => {
    expect(resolveCalendarDate("2026-09-20", TODAY)).toBe("2026-09-20");
  });

  test("falls back to today when missing or malformed", () => {
    expect(resolveCalendarDate(undefined, TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("2026-13-01", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("yesterday", TODAY)).toBe(TODAY);
  });

  test("falls back to today beyond a year in either direction", () => {
    expect(resolveCalendarDate("2027-09-16", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("2025-09-16", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("9999-12-31", TODAY)).toBe(TODAY);
  });
});

describe("visibleDays and findDay", () => {
  test("six days without Saturday", () => {
    const week: Week = { days: SIX_DAYS, saturday: null };
    expect(visibleDays(week).map((d) => d.date)).toEqual(SIX_DAYS.map((d) => d.date));
    expect(findDay(week, "2026-09-19")).toBeNull();
  });

  test("Saturday is appended when the week has one", () => {
    const saturday = day("2026-09-19", 6);
    const week: Week = { days: SIX_DAYS, saturday };
    expect(visibleDays(week).at(-1)).toBe(saturday);
    expect(findDay(week, "2026-09-19")).toBe(saturday);
  });

  test("finds a weekday", () => {
    const week: Week = { days: SIX_DAYS, saturday: null };
    expect(findDay(week, TODAY)?.weekday).toBe(3);
  });
});
