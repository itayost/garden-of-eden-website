import { describe, it, expect } from "vitest";
import { canManageBranches, isInBranchScope, resolveBranchScope } from "../branch-scope";

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

  it("gives a trainer with no branch nobody, until an admin assigns one", () => {
    expect(resolveBranchScope("trainer", [])).toEqual({ kind: "branches", ids: [] });
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

describe("canManageBranches", () => {
  it("lets an admin manage any branch", () => {
    expect(canManageBranches("admin", [], ["b1"])).toBe(true);
  });

  it("lets a trainer manage only branches they manage", () => {
    expect(canManageBranches("trainer", ["b1"], ["b1"])).toBe(true);
    expect(canManageBranches("trainer", ["b1"], ["b2"])).toBe(false);
    expect(canManageBranches("trainer", ["b1"], ["b2", "b1"])).toBe(true);
  });

  it("refuses a trainer who manages nothing, and an empty target", () => {
    expect(canManageBranches("trainer", [], ["b1"])).toBe(false);
    expect(canManageBranches("trainer", ["b1"], [])).toBe(false);
  });

  it("refuses any other role", () => {
    expect(canManageBranches("trainee", ["b1"], ["b1"])).toBe(false);
  });
});
