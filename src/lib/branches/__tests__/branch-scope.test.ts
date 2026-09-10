import { describe, it, expect } from "vitest";
import { resolveBranchScope, isInBranchScope } from "../branch-scope";

describe("resolveBranchScope", () => {
  it("gives admins everything regardless of memberships", () => {
    expect(resolveBranchScope("admin", ["b1"])).toEqual({ kind: "all" });
    expect(resolveBranchScope("admin", [])).toEqual({ kind: "all" });
  });

  it("scopes a trainer to their branches", () => {
    expect(resolveBranchScope("trainer", ["b1", "b2"])).toEqual({
      kind: "branches",
      ids: ["b1", "b2"],
    });
  });

  it("fails open for a trainer with no branch", () => {
    expect(resolveBranchScope("trainer", [])).toEqual({ kind: "all" });
  });
});

describe("isInBranchScope", () => {
  it("accepts anyone under an all scope", () => {
    expect(isInBranchScope({ kind: "all" }, [])).toBe(true);
    expect(isInBranchScope({ kind: "all" }, ["b9"])).toBe(true);
  });

  it("requires at least one shared branch under a branches scope", () => {
    const scope = { kind: "branches" as const, ids: ["b1", "b2"] };
    expect(isInBranchScope(scope, ["b2", "b3"])).toBe(true);
    expect(isInBranchScope(scope, ["b3"])).toBe(false);
    expect(isInBranchScope(scope, [])).toBe(false);
  });
});
