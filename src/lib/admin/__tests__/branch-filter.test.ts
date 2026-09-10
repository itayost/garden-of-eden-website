import { describe, it, expect } from "vitest";
import {
  BRANCH_FILTER_ALL,
  BRANCH_FILTER_NONE,
  buildBranchFilterOptions,
  matchesBranchFilter,
} from "../branch-filter";

describe("matchesBranchFilter", () => {
  it("passes everything for null or ALL", () => {
    expect(matchesBranchFilter([], null)).toBe(true);
    expect(matchesBranchFilter(["b1"], BRANCH_FILTER_ALL)).toBe(true);
  });

  it("passes only unassigned users for NONE", () => {
    expect(matchesBranchFilter([], BRANCH_FILTER_NONE)).toBe(true);
    expect(matchesBranchFilter(["b1"], BRANCH_FILTER_NONE)).toBe(false);
  });

  it("passes users that belong to the selected branch, including dual-branch users", () => {
    expect(matchesBranchFilter(["b1", "b2"], "b1")).toBe(true);
    expect(matchesBranchFilter(["b1", "b2"], "b2")).toBe(true);
    expect(matchesBranchFilter(["b2"], "b1")).toBe(false);
    expect(matchesBranchFilter([], "b1")).toBe(false);
  });
});

describe("buildBranchFilterOptions", () => {
  it("wraps the branches with ALL first and NONE last", () => {
    expect(
      buildBranchFilterOptions([
        { id: "b1", nameHe: "חיפה" },
        { id: "b2", nameHe: "קריית אתא" },
      ]),
    ).toEqual([
      { value: BRANCH_FILTER_ALL, label: "כל הסניפים" },
      { value: "b1", label: "חיפה" },
      { value: "b2", label: "קריית אתא" },
      { value: BRANCH_FILTER_NONE, label: "ללא סניף" },
    ]);
  });
});
