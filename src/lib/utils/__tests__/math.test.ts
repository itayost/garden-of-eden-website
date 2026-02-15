import { describe, it, expect } from "vitest";
import { calculatePercentile } from "../math";

describe("calculatePercentile", () => {
  it("returns 50 for empty array", () => {
    expect(calculatePercentile(10, [], true)).toBe(50);
    expect(calculatePercentile(10, [], false)).toBe(50);
  });

  it("returns highest percentile for best value (lowerIsBetter=true)", () => {
    const values = [1.5, 2.0, 2.5, 3.0];
    // 1.5 is best (lowest), worseCount = 3 (2.0, 2.5, 3.0), percentile = 3/4*100 = 75
    expect(calculatePercentile(1.5, values, true)).toBe(75);
  });

  it("returns 0 for worst value (lowerIsBetter=true)", () => {
    const values = [1.5, 2.0, 2.5, 3.0];
    // 3.0 is worst (highest), worseCount = 0, percentile = 0
    expect(calculatePercentile(3.0, values, true)).toBe(0);
  });

  it("returns highest percentile for best value (lowerIsBetter=false)", () => {
    const values = [100, 200, 300, 400];
    // 400 is best (highest), worseCount = 3, percentile = 3/4*100 = 75
    expect(calculatePercentile(400, values, false)).toBe(75);
  });

  it("returns 0 for worst value (lowerIsBetter=false)", () => {
    const values = [100, 200, 300, 400];
    // 100 is worst (lowest), worseCount = 0, percentile = 0
    expect(calculatePercentile(100, values, false)).toBe(0);
  });

  it("returns ~50 for middle value", () => {
    const values = [1, 2, 3, 4, 5];
    // value=3, lowerIsBetter=true: worseCount = 2 (4,5) -> 2/5*100 = 40
    expect(calculatePercentile(3, values, true)).toBe(40);
    // value=3, lowerIsBetter=false: worseCount = 2 (1,2) -> 2/5*100 = 40
    expect(calculatePercentile(3, values, false)).toBe(40);
  });

  it("handles single value array", () => {
    // Same value: worseCount=0, percentile = 0/1*100 = 0
    expect(calculatePercentile(5, [5], true)).toBe(0);
    expect(calculatePercentile(5, [5], false)).toBe(0);
  });

  it("handles tied values", () => {
    const values = [2, 2, 2, 2];
    // All same: worseCount=0, percentile = 0
    expect(calculatePercentile(2, values, true)).toBe(0);
    expect(calculatePercentile(2, values, false)).toBe(0);
  });

  it("handles value not in the array", () => {
    const values = [1, 3, 5, 7];
    // value=4, lowerIsBetter=true: worseCount = 2 (5, 7) -> 2/4*100 = 50
    expect(calculatePercentile(4, values, true)).toBe(50);
  });
});
