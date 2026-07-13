import { describe, it, expect } from "vitest";
import { getCategoryForMembershipType } from "../retention";

/**
 * The membership type names below are the real values Arbox returns for this
 * box, taken from the expired* reports for 2026-03 through 2026-06.
 */
describe("getCategoryForMembershipType", () => {
  it("routes PRO memberships", () => {
    expect(getCategoryForMembershipType("מנוי פרו")).toBe("pro");
  });

  it("routes the monthly memberships", () => {
    expect(getCategoryForMembershipType("מנוי מתקדמים חודש")).toBe("monthly");
    expect(getCategoryForMembershipType("מנוי מתקדמים 4 חודשים")).toBe("monthly");
    expect(
      getCategoryForMembershipType("מנוי מתקדמים פעמיים בשבוע מתמשך קבוע"),
    ).toBe("monthly");
  });

  it("routes the plain training card", () => {
    expect(getCategoryForMembershipType("כרטיסייה")).toBe("training_card");
  });

  it("routes a training card whose name carries a suffix", () => {
    // Regression: this was dropped from every report because the check was an
    // exact match on "כרטיסייה" rather than a contains-match.
    expect(getCategoryForMembershipType("כרטיסיית 10 כניסות")).toBe(
      "training_card",
    );
  });

  it("returns null for a missing type", () => {
    expect(getCategoryForMembershipType(null)).toBeNull();
    expect(getCategoryForMembershipType("")).toBeNull();
  });

  it("still refuses the types that are Eden's call, rather than guessing", () => {
    // These are deliberately unmapped. They must not be silently absorbed into
    // a tab by a loosened match.
    expect(getCategoryForMembershipType("מחנה קיץ - הכנה לעונה")).toBeNull();
    expect(getCategoryForMembershipType("מנוי עממי 3 פעמים בשבוע")).toBeNull();
    expect(
      getCategoryForMembershipType("מנוי עממי 3 פעמים בשבוע- לחודש אחד"),
    ).toBeNull();
  });
});
