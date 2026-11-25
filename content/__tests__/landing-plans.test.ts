import { describe, it, expect } from "vitest";
import { landingBlurb } from "../landing-plans";

describe("landingBlurb", () => {
  it("drops a per-session price and keeps the rest", () => {
    expect(landingBlurb("מנצלים בקצב שלכם. ₪210 לאימון")).toBe("מנצלים בקצב שלכם");
  });
  it("drops a per-session price in parentheses", () => {
    expect(landingBlurb("4 מפגשים (90 ₪ למפגש). חד-פעמי לשחקן חדש")).toBe("4 מפגשים. חד-פעמי לשחקן חדש");
  });
  it("drops the validity sentence the card already shows under the price", () => {
    expect(landingBlurb("125 ₪ לאימון. תוקף: 14 שבועות")).toBeNull();
    expect(landingBlurb('100 ש"ח לאימון. תוקף: 28 שבועות')).toBeNull();
  });
  it("leaves a blurb with no per-session price as typed", () => {
    expect(landingBlurb("מנוי חודשי")).toBe("מנוי חודשי");
    expect(landingBlurb("2 אימונים בשבוע, . הבחירה המשתלמת ביותר")).toBe("2 אימונים בשבוע, . הבחירה המשתלמת ביותר");
  });
  it("treats an empty blurb as none", () => {
    expect(landingBlurb(null)).toBeNull();
    expect(landingBlurb("  ")).toBeNull();
  });
});
