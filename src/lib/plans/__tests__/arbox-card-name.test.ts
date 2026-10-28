import { describe, expect, it } from "vitest";
import { arboxCardName } from "../arbox-card-name";

const card10 = { name_he: "כרטיסיית 10 אימונים", kind: "session_card" as const, sessions_total: 10 };

describe("arboxCardName", () => {
  it("names a Card by its own sessions when they differ from the catalog Card it is filed under", () => {
    expect(arboxCardName(card10, 3)).toBe("כרטיסיית 3 אימונים");
    expect(arboxCardName(card10, 27)).toBe("כרטיסיית 27 אימונים");
  });

  it("names a one-session Card in the singular", () => {
    expect(arboxCardName(card10, 1)).toBe("כרטיסיית אימון אחד");
  });

  it("keeps the product name when the sessions match it", () => {
    expect(arboxCardName(card10, 10)).toBe("כרטיסיית 10 אימונים");
  });

  it("keeps the product name of anything that is not a Card", () => {
    const monthly = { name_he: "מנוי חודשי", kind: "subscription" as const, sessions_total: null };
    expect(arboxCardName(monthly, null)).toBe("מנוי חודשי");
    expect(arboxCardName(monthly, 8)).toBe("מנוי חודשי");
  });

  it("keeps the product name when the Plan has no session count", () => {
    expect(arboxCardName(card10, null)).toBe("כרטיסיית 10 אימונים");
  });
});
