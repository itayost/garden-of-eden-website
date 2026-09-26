import { describe, it, expect } from "vitest";
import { arboxBranchFor, branchFromArboxName, matchArboxBranch } from "../arbox-branch-match";
import type { Branch } from "@/types/branches";

function branch(overrides: Partial<Branch> & { id: string }): Branch {
  return {
    name_he: "x",
    arbox_location_name: null,
    is_active: true,
    order_index: 0,
    manager_phone: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const haifa = branch({ id: "h", name_he: "חיפה", arbox_location_name: "גארדן חיפה" });
const kiryat = branch({ id: "k", name_he: "קריית אתא", arbox_location_name: "גארדן קריית אתא" });
const inactive = branch({ id: "i", name_he: "ישן", arbox_location_name: "ישן", is_active: false });

describe("matchArboxBranch", () => {
  it("matches an exact Arbox location name after trimming", () => {
    expect(matchArboxBranch(" גארדן חיפה ", [haifa, kiryat])).toBe(haifa);
  });

  it("returns null when nothing matches", () => {
    expect(matchArboxBranch("גארדן אוף עדן", [haifa, kiryat])).toBeNull();
  });

  it("ignores inactive branches", () => {
    expect(matchArboxBranch("ישן", [inactive, haifa])).toBeNull();
  });

  it("returns null for a null or empty location", () => {
    expect(matchArboxBranch(null, [haifa])).toBeNull();
    expect(matchArboxBranch("", [haifa])).toBeNull();
  });

  it("ignores branches with no Arbox name", () => {
    const bare = branch({ id: "b", name_he: "חיפה" });
    expect(matchArboxBranch("חיפה", [bare])).toBeNull();
  });
});

describe("branchFromArboxName", () => {
  // The branches as production has them: no Arbox location names.
  const haifaBare = branch({ id: "h", name_he: "חיפה" });
  const kiryatBare = branch({ id: "k", name_he: "קריית אתא" });
  const all = [haifaBare, kiryatBare];

  it("puts a name tagged קריות in קריית אתא, wherever the tag sits", () => {
    expect(branchFromArboxName("ליאב כלפון (קריות)", all)).toBe(kiryatBare);
    expect(branchFromArboxName("מוחמד סעדי קריות", all)).toBe(kiryatBare);
    expect(branchFromArboxName("לביא קריות מאיר", all)).toBe(kiryatBare);
  });

  it("puts every other name in חיפה", () => {
    expect(branchFromArboxName("נועם ( עתלית ) משיר", all)).toBe(haifaBare);
    expect(branchFromArboxName("רוי ביטון", all)).toBe(haifaBare);
  });

  it("puts a missing name in חיפה", () => {
    expect(branchFromArboxName(null, all)).toBe(haifaBare);
    expect(branchFromArboxName("", all)).toBe(haifaBare);
  });

  it("returns null when the branch it points to is inactive or missing", () => {
    const closedKiryat = branch({ id: "k", name_he: "קריית אתא", is_active: false });
    expect(branchFromArboxName("דני (קריות)", [haifaBare, closedKiryat])).toBeNull();
    expect(branchFromArboxName("דני", [kiryatBare])).toBeNull();
  });
});

describe("arboxBranchFor", () => {
  const haifaBare = branch({ id: "h", name_he: "חיפה" });
  const kiryatBare = branch({ id: "k", name_he: "קריית אתא" });
  const base = {
    locationName: "גארדן אוף עדן",
    fullName: "יוסי (קריות)",
    currentBranchIds: [] as string[],
    setByAdminAt: null,
    isTrainee: true,
  };

  it("never touches a profile whose branches an admin set", () => {
    expect(arboxBranchFor({ ...base, setByAdminAt: "2026-09-01T00:00:00Z" }, [haifa, kiryat])).toBeNull();
  });

  it("prefers a matching Arbox location over the name", () => {
    expect(arboxBranchFor({ ...base, locationName: "גארדן חיפה" }, [haifa, kiryat])).toBe(haifa);
  });

  it("falls back to the name for a trainee with no branch", () => {
    expect(arboxBranchFor(base, [haifaBare, kiryatBare])).toBe(kiryatBare);
  });

  it("leaves a trainee who already has a branch alone when no location matches", () => {
    expect(arboxBranchFor({ ...base, currentBranchIds: ["h"] }, [haifaBare, kiryatBare])).toBeNull();
  });

  it("never guesses a branch for staff", () => {
    expect(arboxBranchFor({ ...base, isTrainee: false }, [haifaBare, kiryatBare])).toBeNull();
  });
});
