import { describe, it, expect } from "vitest";
import { resolveRequestedBranch } from "../resolve-branch";

const branches = [
  { id: "h", nameHe: "חיפה" },
  { id: "k", nameHe: "קריית אתא" },
];

describe("resolveRequestedBranch", () => {
  it("honours a valid request inside an all scope", () => {
    expect(
      resolveRequestedBranch({ requested: "k", scope: { kind: "all" }, branches }),
    ).toBe("k");
  });

  it("falls back to the first branch when the request is unknown", () => {
    expect(
      resolveRequestedBranch({ requested: "zzz", scope: { kind: "all" }, branches }),
    ).toBe("h");
    expect(
      resolveRequestedBranch({ requested: undefined, scope: { kind: "all" }, branches }),
    ).toBe("h");
  });

  it("ignores a request outside the caller's scope", () => {
    const scope = { kind: "branches" as const, ids: ["k"] };
    expect(resolveRequestedBranch({ requested: "h", scope, branches })).toBe("k");
  });

  it("defaults to the caller's first branch in display order", () => {
    const scope = { kind: "branches" as const, ids: ["k", "h"] };
    expect(resolveRequestedBranch({ requested: null, scope, branches })).toBe("h");
  });

  it("returns null when no branch is allowed", () => {
    expect(
      resolveRequestedBranch({ requested: "h", scope: { kind: "all" }, branches: [] }),
    ).toBeNull();
    const scope = { kind: "branches" as const, ids: ["gone"] };
    expect(resolveRequestedBranch({ requested: null, scope, branches })).toBeNull();
  });
});
