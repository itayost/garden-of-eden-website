import { describe, it, expect } from "vitest";
import { matchArboxBranch } from "../arbox-branch-match";
import type { Branch } from "@/types/branches";

function branch(overrides: Partial<Branch> & { id: string }): Branch {
  return {
    name_he: "x",
    arbox_location_name: null,
    is_active: true,
    order_index: 0,
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
