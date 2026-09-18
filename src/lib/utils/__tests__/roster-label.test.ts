import { describe, expect, test } from "vitest";

import { rosterLabel } from "@/lib/utils/roster-label";

describe("rosterLabel", () => {
  test("spells out the singular instead of pairing it with a numeral", () => {
    expect(rosterLabel(1)).toBe("מתאמן אחד");
  });

  test("uses the numeral from two up", () => {
    expect(rosterLabel(2)).toBe("2 מתאמנים");
    expect(rosterLabel(6)).toBe("6 מתאמנים");
  });

  test("an empty roster is a count like any other", () => {
    expect(rosterLabel(0)).toBe("0 מתאמנים");
  });
});
