import { describe, expect, it } from "vitest";
import { formatSleepHours, isSleepHours, stepSleep } from "../checkin";

describe("isSleepHours", () => {
  it("accepts whole and half hours inside the range", () => {
    for (const value of [3, 7.5, 8, 12]) expect(isSleepHours(value)).toBe(true);
  });

  it("refuses values outside it or between half hours", () => {
    for (const value of [2.5, 12.5, 7.25, Number.NaN]) expect(isSleepHours(value)).toBe(false);
  });
});

describe("stepSleep", () => {
  it("moves half an hour", () => {
    expect(stepSleep(8, 1)).toBe(8.5);
    expect(stepSleep(8, -1)).toBe(7.5);
  });

  it("stops at the ends", () => {
    expect(stepSleep(3, -1)).toBe(3);
    expect(stepSleep(12, 1)).toBe(12);
  });
});

describe("formatSleepHours", () => {
  it("drops a needless decimal", () => {
    expect(formatSleepHours(7)).toBe("7");
    expect(formatSleepHours(7.5)).toBe("7.5");
  });
});
