import { describe, it, expect } from "vitest";
import { calculateWeeklyAverage } from "../reports";

describe("calculateWeeklyAverage", () => {
  it("calculates correct weekly average", () => {
    // 4 sessions over 2 weeks (14 days = Jan 1 to Jan 15)
    const result = calculateWeeklyAverage(4, "2026-01-01", "2026-01-15");
    expect(result).toBe(2);
  });

  it("returns 0 for zero sessions", () => {
    const result = calculateWeeklyAverage(0, "2026-01-01", "2026-01-14");
    expect(result).toBe(0);
  });

  it("handles single day range", () => {
    const result = calculateWeeklyAverage(1, "2026-01-01", "2026-01-01");
    expect(result).toBe(7); // 1 session in 1 day = 7/week
  });

  it("returns 0 for inverted date range", () => {
    const result = calculateWeeklyAverage(4, "2026-01-15", "2026-01-01");
    expect(result).toBe(0);
  });
});
