import { describe, expect, test } from "vitest";

import {
  buildWeek,
  defaultWeekStart,
  isBuildableDay,
  startOfWeek,
  weekDates,
  weekRangeLabel,
} from "../schedule-week";
import type { ScheduleSlot } from "@/types/schedule";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

const LIDOR = "11111111-1111-4111-8111-111111111111";
const NADAV = "22222222-2222-4222-8222-222222222222";

/** 2026-08-16 is a Sunday; the week runs to Saturday 2026-08-22. */
const SUNDAY = "2026-08-16";
const WEDNESDAY = "2026-08-19";
const FRIDAY = "2026-08-21";
const SATURDAY = "2026-08-22";

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: "slot-1",
    schedule_date: SUNDAY,
    start_time: "17:00:00",
    trainer_id: LIDOR,
    trainer_name: "לידור",
    focus_he: null,
    location_he: "סטודיו",
    trainees: [],
    created_by: LIDOR,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

function band(overrides: Partial<WeeklyBand> = {}): WeeklyBand {
  return {
    id: "band-1",
    weekday: 0,
    start_time: "15:00:00",
    end_time: "18:00:00",
    trainer_id: LIDOR,
    trainer_name: "לידור",
    location_he: "סטודיו",
    label_he: null,
    is_standby: false,
    created_by: LIDOR,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function exception(overrides: Partial<WeeklyException> = {}): WeeklyException {
  return {
    id: "exception-1",
    exception_date: SUNDAY,
    trainer_id: LIDOR,
    trainer_name: "לידור",
    kind: "absent",
    start_time: null,
    end_time: null,
    location_he: null,
    label_he: null,
    note_he: null,
    created_by: LIDOR,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildWeek>[0]> = {}) {
  return buildWeek({
    weekStart: SUNDAY,
    today: SUNDAY,
    slots: [],
    bands: [],
    exceptions: [],
    ...overrides,
  });
}

describe("startOfWeek", () => {
  test("a Sunday returns itself", () => {
    expect(startOfWeek(SUNDAY)).toBe(SUNDAY);
  });

  test("a Wednesday returns the Sunday that opened the week", () => {
    expect(startOfWeek(WEDNESDAY)).toBe(SUNDAY);
  });

  // The one that is easy to get backwards: Saturday closes the Israeli week,
  // so it reaches back six days rather than forward one.
  test("a Saturday reaches back six days", () => {
    expect(startOfWeek(SATURDAY)).toBe(SUNDAY);
  });

  test("crosses a month boundary", () => {
    expect(startOfWeek("2026-09-01")).toBe("2026-08-30");
  });

  test("crosses a year boundary", () => {
    expect(startOfWeek("2026-01-01")).toBe("2025-12-28");
  });
});

describe("defaultWeekStart", () => {
  test("on a Sunday it opens that week", () => {
    expect(defaultWeekStart(SUNDAY)).toBe(SUNDAY);
  });

  test("mid-week it opens the current week", () => {
    expect(defaultWeekStart(WEDNESDAY)).toBe(SUNDAY);
  });

  // Opening the page on Saturday to plan tomorrow must not show the week that
  // just ended.
  test("on a Saturday it opens the week that starts tomorrow", () => {
    expect(defaultWeekStart(SATURDAY)).toBe("2026-08-23");
  });
});

describe("weekDates", () => {
  test("returns seven consecutive dates from the Sunday", () => {
    expect(weekDates(SUNDAY)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
    ]);
  });

  test("crosses a month boundary", () => {
    expect(weekDates("2026-08-30")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });

  // Israel springs forward on 2026-03-27, inside this week.
  test("a DST week still has seven distinct days", () => {
    const dates = weekDates("2026-03-22");
    expect(dates).toHaveLength(7);
    expect(new Set(dates).size).toBe(7);
    expect(dates.at(-1)).toBe("2026-03-28");
  });
});

describe("buildWeek", () => {
  test("returns Sunday to Friday", () => {
    const week = build();
    expect(week.days.map((day) => day.date)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  test("omits Saturday when nothing is on it", () => {
    expect(build().saturday).toBeNull();
  });

  test("includes Saturday when it has a slot", () => {
    const week = build({ slots: [slot({ schedule_date: SATURDAY })] });
    expect(week.saturday?.date).toBe(SATURDAY);
    expect(week.saturday?.slots).toHaveLength(1);
  });

  test("includes Saturday when it has a one-off extra", () => {
    const week = build({
      exceptions: [
        exception({
          exception_date: SATURDAY,
          kind: "extra",
          start_time: "10:00:00",
        }),
      ],
    });
    expect(week.saturday?.date).toBe(SATURDAY);
    expect(week.saturday?.onDuty.bands).toHaveLength(1);
  });

  test("puts each slot on its own date", () => {
    const week = build({
      slots: [
        slot({ id: "a", schedule_date: SUNDAY }),
        slot({ id: "b", schedule_date: WEDNESDAY }),
      ],
    });
    expect(week.days[0].slots.map((s) => s.id)).toEqual(["a"]);
    expect(week.days[3].slots.map((s) => s.id)).toEqual(["b"]);
  });

  test("preserves the order the action returned within a day", () => {
    const week = build({
      slots: [
        slot({ id: "first", start_time: "16:00:00" }),
        slot({ id: "second", start_time: "18:00:00" }),
      ],
    });
    expect(week.days[0].slots.map((s) => s.id)).toEqual(["first", "second"]);
  });

  test("gives every weekday an empty list rather than nothing", () => {
    const week = build();
    for (const day of week.days) expect(day.slots).toEqual([]);
  });

  test("drops a slot dated outside the week", () => {
    const week = build({ slots: [slot({ schedule_date: "2026-08-09" })] });
    expect(week.days.flatMap((day) => day.slots)).toHaveLength(0);
  });

  test("an unbuilt day still carries the template staffing", () => {
    const week = build({ bands: [band({ weekday: 0 })] });
    expect(week.days[0].isBuilt).toBe(false);
    expect(week.days[0].onDuty.bands).toHaveLength(1);
  });

  test("a day with slots is built", () => {
    const week = build({ slots: [slot()] });
    expect(week.days[0].isBuilt).toBe(true);
  });

  test("exposes that date's extras separately from the standing bands", () => {
    const week = build({
      bands: [band({ weekday: 0 })],
      exceptions: [
        exception({ kind: "extra", start_time: "19:00:00", trainer_id: NADAV }),
      ],
    });
    expect(week.days[0].onDuty.bands).toHaveLength(2);
    expect(week.days[0].extras.map((b) => b.trainerId)).toEqual([NADAV]);
  });

  test("exposes that date's absences", () => {
    const week = build({
      bands: [band({ weekday: 0 })],
      exceptions: [exception({ kind: "absent" })],
    });
    expect(week.days[0].onDuty.absences.map((a) => a.trainerId)).toEqual([LIDOR]);
  });

  test("an exception dated elsewhere does not leak into a day", () => {
    const week = build({
      bands: [band({ weekday: 0 })],
      exceptions: [exception({ exception_date: WEDNESDAY, kind: "absent" })],
    });
    expect(week.days[0].onDuty.absences).toHaveLength(0);
    expect(week.days[0].onDuty.bands).toHaveLength(1);
  });

  test("marks exactly one day as today when today is inside the week", () => {
    const week = build({ today: WEDNESDAY });
    expect(week.days.filter((day) => day.isToday).map((day) => day.date)).toEqual([
      WEDNESDAY,
    ]);
  });

  test("marks no day as today when the week is elsewhere", () => {
    const week = build({ today: "2026-09-09" });
    expect(week.days.some((day) => day.isToday)).toBe(false);
  });

  test("marks the days before today as past", () => {
    const week = build({ today: WEDNESDAY });
    expect(week.days.filter((day) => day.isPast).map((day) => day.date)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
  });

  test("Friday derives its own weekday's bands", () => {
    const week = build({ bands: [band({ weekday: 5, trainer_id: NADAV })] });
    expect(week.days[0].onDuty.bands).toHaveLength(0);
    expect(week.days[5].date).toBe(FRIDAY);
    expect(week.days[5].onDuty.bands).toHaveLength(1);
  });
});

describe("weekRangeLabel", () => {
  test("labels the working week, Sunday to Friday", () => {
    expect(weekRangeLabel(SUNDAY)).toBe("16.8–21.8");
  });

  test("qualifies the year when the week straddles one", () => {
    expect(weekRangeLabel("2026-12-27")).toBe("27.12.2026–1.1.2027");
  });
});

describe("isBuildableDay", () => {
  const dayFrom = (overrides: Parameters<typeof build>[0] = {}) =>
    build(overrides).days[0];

  test("offers an unbuilt future day the template staffs", () => {
    const day = dayFrom({ today: "2026-08-10", bands: [band({ weekday: 0 })] });
    expect(isBuildableDay(day)).toBe(true);
  });

  test("skips a day that already has a board", () => {
    const day = dayFrom({
      today: "2026-08-10",
      bands: [band({ weekday: 0 })],
      slots: [slot()],
    });
    expect(isBuildableDay(day)).toBe(false);
  });

  test("skips a day already past", () => {
    const day = dayFrom({ today: WEDNESDAY, bands: [band({ weekday: 0 })] });
    expect(isBuildableDay(day)).toBe(false);
  });

  test("offers today itself", () => {
    const day = dayFrom({ today: SUNDAY, bands: [band({ weekday: 0 })] });
    expect(isBuildableDay(day)).toBe(true);
  });

  test("skips a day the template staffs with nobody", () => {
    const day = dayFrom({ today: "2026-08-10" });
    expect(isBuildableDay(day)).toBe(false);
  });

  test("skips a day whose only stretch is standby", () => {
    const day = dayFrom({
      today: "2026-08-10",
      bands: [band({ weekday: 0, is_standby: true })],
    });
    expect(isBuildableDay(day)).toBe(false);
  });
});
