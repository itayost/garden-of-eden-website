import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getIsraelTime,
  isSaturdayInIsrael,
  getAutoClockoutHour,
  israelMinutesOfDay,
  inferShiftPeriod,
  isWithinMorningWindow,
  isMorningShiftAllowed,
} from "../israel-time";
import type { IsraelTime } from "../israel-time";

describe("getIsraelTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct dateStr format YYYY-MM-DD", () => {
    // 2026-02-15 is a Sunday
    vi.setSystemTime(new Date("2026-02-15T10:30:00Z"));
    const result = getIsraelTime();
    expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateStr).toBe("2026-02-15");
  });

  it("parses hour and minute correctly", () => {
    // Israel is UTC+2 in winter, so 10:30 UTC = 12:30 Israel
    vi.setSystemTime(new Date("2026-02-15T10:30:00Z"));
    const result = getIsraelTime();
    expect(result.hour).toBe(12);
    expect(result.minute).toBe(30);
  });

  it("returns Sunday (0) for a known Sunday UTC date", () => {
    // 2026-02-15 is a Sunday
    vi.setSystemTime(new Date("2026-02-15T10:00:00Z"));
    const result = getIsraelTime();
    expect(result.dayOfWeek).toBe(0);
  });

  it("returns Saturday (6) for a known Saturday UTC date", () => {
    // 2026-02-14 is a Saturday
    vi.setSystemTime(new Date("2026-02-14T10:00:00Z"));
    const result = getIsraelTime();
    expect(result.dayOfWeek).toBe(6);
  });

  it("returns Friday (5) for a known Friday", () => {
    // 2026-02-13 is a Friday
    vi.setSystemTime(new Date("2026-02-13T10:00:00Z"));
    const result = getIsraelTime();
    expect(result.dayOfWeek).toBe(5);
  });

  it("handles date rollover near midnight (UTC late -> Israel next day)", () => {
    // 2026-02-15 23:00 UTC = 2026-02-16 01:00 Israel (Monday)
    vi.setSystemTime(new Date("2026-02-15T23:00:00Z"));
    const result = getIsraelTime();
    expect(result.dateStr).toBe("2026-02-16");
    expect(result.dayOfWeek).toBe(1); // Monday
    expect(result.hour).toBe(1);
  });

  it("accepts explicit Date argument", () => {
    const date = new Date("2026-02-14T10:00:00Z"); // Saturday
    const result = getIsraelTime(date);
    expect(result.dayOfWeek).toBe(6);
  });
});

describe("isSaturdayInIsrael", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for Saturday in Israel", () => {
    vi.setSystemTime(new Date("2026-02-14T10:00:00Z"));
    expect(isSaturdayInIsrael()).toBe(true);
  });

  it("returns false for weekday", () => {
    vi.setSystemTime(new Date("2026-02-15T10:00:00Z")); // Sunday
    expect(isSaturdayInIsrael()).toBe(false);
  });

  it("returns false for Friday", () => {
    vi.setSystemTime(new Date("2026-02-13T10:00:00Z"));
    expect(isSaturdayInIsrael()).toBe(false);
  });

  it("handles Friday evening UTC that becomes Saturday in Israel", () => {
    // 2026-02-13 (Friday) 22:30 UTC = 2026-02-14 (Saturday) 00:30 Israel
    vi.setSystemTime(new Date("2026-02-13T22:30:00Z"));
    expect(isSaturdayInIsrael()).toBe(true);
  });
});

// Israel runs UTC+2 in winter (IST) and UTC+3 in summer (IDT). These fixtures
// pin real UTC instants to known Israel wall-clock times on both sides of the
// 2026 DST boundary (DST starts 2026-03-27), so the helpers are exercised
// against real timezone math rather than a fixed offset.
const SUMMER_0759_IL = new Date("2026-07-15T04:59:00Z");
const SUMMER_0800_IL = new Date("2026-07-15T05:00:00Z");
const SUMMER_0930_IL = new Date("2026-07-15T06:30:00Z");
const SUMMER_1059_IL = new Date("2026-07-15T07:59:00Z");
const SUMMER_1100_IL = new Date("2026-07-15T08:00:00Z");
const SUMMER_1600_IL = new Date("2026-07-15T13:00:00Z");
const WINTER_0800_IL = new Date("2026-01-15T06:00:00Z");
const WINTER_1100_IL = new Date("2026-01-15T09:00:00Z");

describe("israelMinutesOfDay", () => {
  it("converts Israel wall-clock time to minutes since midnight", () => {
    expect(israelMinutesOfDay(SUMMER_0800_IL)).toBe(8 * 60);
    expect(israelMinutesOfDay(SUMMER_0930_IL)).toBe(9 * 60 + 30);
  });

  it("uses the winter offset for a winter date", () => {
    expect(israelMinutesOfDay(WINTER_0800_IL)).toBe(8 * 60);
  });
});

describe("inferShiftPeriod", () => {
  it("classifies 08:00 Israel time as morning (inclusive lower bound)", () => {
    expect(inferShiftPeriod(SUMMER_0800_IL)).toBe("morning");
  });

  it("classifies 07:59 Israel time as regular", () => {
    expect(inferShiftPeriod(SUMMER_0759_IL)).toBe("regular");
  });

  it("classifies 10:59 Israel time as morning", () => {
    expect(inferShiftPeriod(SUMMER_1059_IL)).toBe("morning");
  });

  it("classifies exactly 11:00 Israel time as regular (exclusive upper bound)", () => {
    expect(inferShiftPeriod(SUMMER_1100_IL)).toBe("regular");
  });

  it("classifies an afternoon clock-in as regular", () => {
    expect(inferShiftPeriod(SUMMER_1600_IL)).toBe("regular");
  });

  it("respects DST: the same UTC instant classifies differently across the boundary", () => {
    // 05:00Z is 08:00 Israel in summer (UTC+3) but 07:00 Israel in winter (UTC+2).
    expect(inferShiftPeriod(new Date("2026-07-15T05:00:00Z"))).toBe("morning");
    expect(inferShiftPeriod(new Date("2026-01-15T05:00:00Z"))).toBe("regular");
  });
});

// Friday runs a single 09:00-15:00 shift with no morning/regular split, so a
// 09:00 Friday clock-in is a full work day, not a morning shift. 2026-07-17
// is a Friday; 2026-07-16 a Thursday.
const FRIDAY_0900_IL = new Date("2026-07-17T06:00:00Z");
const FRIDAY_1000_IL = new Date("2026-07-17T07:00:00Z");
const THURSDAY_0900_IL = new Date("2026-07-16T06:00:00Z");

describe("isMorningShiftAllowed", () => {
  it("allows morning shifts Sunday-Thursday", () => {
    expect(isMorningShiftAllowed(THURSDAY_0900_IL)).toBe(true);
    expect(isMorningShiftAllowed(SUMMER_0800_IL)).toBe(true); // Wednesday
  });

  it("does not allow morning shifts on Friday", () => {
    expect(isMorningShiftAllowed(FRIDAY_0900_IL)).toBe(false);
  });
});

describe("inferShiftPeriod on Friday", () => {
  // Regression: 43 real Friday shifts start between 08:00 and 10:59 and run
  // well past 11:00 (e.g. 10:00-16:00). Classifying them 'morning' would let
  // the morning sweep force-end them at 11:00, hours early.
  it("classifies a 09:00 Friday clock-in as regular, not morning", () => {
    expect(inferShiftPeriod(FRIDAY_0900_IL)).toBe("regular");
  });

  it("classifies a 10:00 Friday clock-in as regular, not morning", () => {
    expect(inferShiftPeriod(FRIDAY_1000_IL)).toBe("regular");
  });

  it("still classifies the same hour on Thursday as morning", () => {
    expect(inferShiftPeriod(THURSDAY_0900_IL)).toBe("morning");
  });
});

describe("isWithinMorningWindow", () => {
  it("accepts a span exactly filling 08:00-11:00", () => {
    expect(isWithinMorningWindow(SUMMER_0800_IL, SUMMER_1100_IL)).toBe(true);
  });

  it("accepts a span nested inside the window", () => {
    expect(isWithinMorningWindow(SUMMER_0930_IL, SUMMER_1059_IL)).toBe(true);
  });

  it("accepts the window on a winter date", () => {
    expect(isWithinMorningWindow(WINTER_0800_IL, WINTER_1100_IL)).toBe(true);
  });

  it("rejects a start before 08:00", () => {
    expect(isWithinMorningWindow(SUMMER_0759_IL, SUMMER_1100_IL)).toBe(false);
  });

  it("rejects an end after 11:00", () => {
    expect(isWithinMorningWindow(SUMMER_0800_IL, SUMMER_1600_IL)).toBe(false);
  });

  it("rejects a span crossing into the next Israel day", () => {
    // 08:00 on the 15th to 09:00 on the 16th — both inside the window by
    // clock time, but not the same calendar day.
    expect(
      isWithinMorningWindow(SUMMER_0800_IL, new Date("2026-07-16T06:00:00Z"))
    ).toBe(false);
  });
});

describe("getAutoClockoutHour", () => {
  it("returns null for Saturday", () => {
    const satTime: IsraelTime = {
      dayOfWeek: 6,
      hour: 10,
      minute: 0,
      dateStr: "2026-02-14",
    };
    expect(getAutoClockoutHour(satTime)).toBeNull();
  });

  it("returns 15 for Friday", () => {
    const friTime: IsraelTime = {
      dayOfWeek: 5,
      hour: 10,
      minute: 0,
      dateStr: "2026-02-13",
    };
    expect(getAutoClockoutHour(friTime)).toBe(15);
  });

  it("returns 20 for Sunday", () => {
    const sunTime: IsraelTime = {
      dayOfWeek: 0,
      hour: 10,
      minute: 0,
      dateStr: "2026-02-15",
    };
    expect(getAutoClockoutHour(sunTime)).toBe(20);
  });

  it("returns 20 for Monday through Thursday", () => {
    for (let day = 1; day <= 4; day++) {
      const weekday: IsraelTime = {
        dayOfWeek: day,
        hour: 10,
        minute: 0,
        dateStr: "2026-02-15",
      };
      expect(getAutoClockoutHour(weekday)).toBe(20);
    }
  });
});
