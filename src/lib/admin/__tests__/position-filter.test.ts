import { describe, it, expect } from "vitest";
import {
  matchesPositionFilter,
  positionFilterOptions,
  POSITION_FILTER_ALL,
  POSITION_FILTER_NONE,
} from "../position-filter";

describe("matchesPositionFilter", () => {
  it("returns true when filter is null", () => {
    expect(matchesPositionFilter("ST", null)).toBe(true);
    expect(matchesPositionFilter(null, null)).toBe(true);
  });

  it("returns true when filter is the ALL sentinel", () => {
    expect(matchesPositionFilter("ST", POSITION_FILTER_ALL)).toBe(true);
    expect(matchesPositionFilter(null, POSITION_FILTER_ALL)).toBe(true);
  });

  it("matches only the exact position when a specific position is selected", () => {
    expect(matchesPositionFilter("ST", "ST")).toBe(true);
    expect(matchesPositionFilter("CF", "ST")).toBe(false);
    expect(matchesPositionFilter(null, "ST")).toBe(false);
    expect(matchesPositionFilter(undefined, "ST")).toBe(false);
  });

  it("matches only null/undefined when NONE is selected", () => {
    expect(matchesPositionFilter(null, POSITION_FILTER_NONE)).toBe(true);
    expect(matchesPositionFilter(undefined, POSITION_FILTER_NONE)).toBe(true);
    expect(matchesPositionFilter("ST", POSITION_FILTER_NONE)).toBe(false);
  });
});

describe("positionFilterOptions", () => {
  it("starts with ALL and ends with NONE", () => {
    expect(positionFilterOptions[0].value).toBe(POSITION_FILTER_ALL);
    expect(positionFilterOptions[positionFilterOptions.length - 1].value).toBe(
      POSITION_FILTER_NONE,
    );
  });

  it("contains all 11 positions with Hebrew labels", () => {
    const values = positionFilterOptions.map((o) => o.value);
    expect(values).toContain("GK");
    expect(values).toContain("ST");
    expect(values).toContain("CAM");
    expect(values).toHaveLength(13);
    const gkOption = positionFilterOptions.find((o) => o.value === "GK");
    expect(gkOption?.label).toBe("שוער");
  });
});
