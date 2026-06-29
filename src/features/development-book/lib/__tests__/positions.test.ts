import { describe, it, expect } from "vitest";
import { expandPositionGroup } from "../positions";

describe("expandPositionGroup", () => {
  it("expands wing group to both wingers", () => {
    expect(expandPositionGroup("wing").sort()).toEqual(["LW", "RW"]);
  });
  it("expands attacker group to forwards", () => {
    expect(expandPositionGroup("attacker").sort()).toEqual(["CF", "ST"]);
  });
  it("returns empty for unknown key", () => {
    expect(expandPositionGroup("nope")).toEqual([]);
  });
});
