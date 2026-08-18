import { describe, expect, test } from "vitest";

import { addDays, daysBetween, shortDate } from "../iso-date";

describe("addDays", () => {
  test("moves one day forward", () => {
    expect(addDays("2026-08-16", 1)).toBe("2026-08-17");
  });

  test("returns the same date for a zero delta", () => {
    expect(addDays("2026-08-16", 0)).toBe("2026-08-16");
  });

  test("crosses a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  test("crosses a year boundary backwards", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  // Israel moves to DST on 2026-03-27 and back on 2026-10-25. The arithmetic is
  // UTC, so neither may shorten or lengthen a day.
  test("is unaffected by the spring DST transition", () => {
    expect(addDays("2026-03-26", 1)).toBe("2026-03-27");
    expect(addDays("2026-03-27", 1)).toBe("2026-03-28");
  });

  test("is unaffected by the autumn DST transition", () => {
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  test("moves a whole week", () => {
    expect(addDays("2026-08-16", 7)).toBe("2026-08-23");
    expect(addDays("2026-08-16", -7)).toBe("2026-08-09");
  });
});

describe("daysBetween", () => {
  test("is zero for the same date", () => {
    expect(daysBetween("2026-08-16", "2026-08-16")).toBe(0);
  });

  test("counts forward", () => {
    expect(daysBetween("2026-08-16", "2026-08-22")).toBe(6);
  });

  test("is signed", () => {
    expect(daysBetween("2026-08-22", "2026-08-16")).toBe(-6);
  });

  test("counts across a month boundary", () => {
    expect(daysBetween("2026-08-30", "2026-09-05")).toBe(6);
  });

  test("counts across a DST transition", () => {
    expect(daysBetween("2026-03-26", "2026-03-28")).toBe(2);
  });
});

describe("shortDate", () => {
  test("strips the leading zero from both parts", () => {
    expect(shortDate("2026-08-06")).toBe("6.8");
  });

  test("leaves two-digit parts alone", () => {
    expect(shortDate("2026-12-25")).toBe("25.12");
  });
});
