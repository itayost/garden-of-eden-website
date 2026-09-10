import { describe, it, expect } from "vitest";
import { pickClockInBranch } from "../clock-in-branch";

describe("pickClockInBranch", () => {
  it("uses the only branch when the trainer has one", () => {
    expect(pickClockInBranch(["h"], null)).toEqual({ ok: true, branchId: "h" });
    expect(pickClockInBranch(["h"], undefined)).toEqual({ ok: true, branchId: "h" });
  });

  it("uses the requested branch when the trainer belongs to it", () => {
    expect(pickClockInBranch(["h", "k"], "k")).toEqual({ ok: true, branchId: "k" });
  });

  it("rejects a requested branch the trainer does not belong to", () => {
    expect(pickClockInBranch(["h"], "k")).toEqual({ ok: false });
  });

  it("records no branch when a dual-branch trainer did not choose", () => {
    expect(pickClockInBranch(["h", "k"], null)).toEqual({ ok: true, branchId: null });
  });

  it("records no branch for an unassigned trainer", () => {
    expect(pickClockInBranch([], null)).toEqual({ ok: true, branchId: null });
    expect(pickClockInBranch([], "h")).toEqual({ ok: false });
  });
});
