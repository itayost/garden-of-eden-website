import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getIsraelTime,
  isSaturdayInIsrael,
  getAutoClockoutHour,
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
