import { describe, it, expect } from "vitest";
import { branchFieldChange } from "../branch-change";

describe("branchFieldChange", () => {
  it("returns null when the sets are equal regardless of order", () => {
    expect(branchFieldChange(["חיפה", "קריית אתא"], ["קריית אתא", "חיפה"])).toBeNull();
    expect(branchFieldChange([], [])).toBeNull();
  });

  it("records a change with names joined by a comma", () => {
    expect(branchFieldChange(["חיפה"], ["חיפה", "קריית אתא"])).toEqual({
      field: "branches",
      old_value: "חיפה",
      new_value: "חיפה, קריית אתא",
    });
  });

  it("records an empty side as null", () => {
    expect(branchFieldChange([], ["חיפה"])).toEqual({
      field: "branches",
      old_value: null,
      new_value: "חיפה",
    });
  });
});
