import { describe, it, expect } from "vitest";
import { isParameterVisible } from "../filtering";

describe("isParameterVisible", () => {
  it("shows all-positions parameter to anyone", () => {
    expect(isParameterVisible({ isAllPositions: true, positions: [] }, "ST")).toBe(true);
  });
  it("shows everything when position is null", () => {
    expect(isParameterVisible({ isAllPositions: false, positions: ["GK"] }, null)).toBe(true);
  });
  it("shows when position matches a tag", () => {
    expect(isParameterVisible({ isAllPositions: false, positions: ["LW", "RW"] }, "RW")).toBe(true);
  });
  it("hides when position does not match", () => {
    expect(isParameterVisible({ isAllPositions: false, positions: ["GK"] }, "ST")).toBe(false);
  });
});
