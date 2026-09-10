import { describe, it, expect } from "vitest";
import { TERMS_SECTIONS, TERMS_VERSION } from "../terms-kiryat-ata";
import { EMERGENCY_NUMBERS, SAFETY_SECTIONS } from "../safety-protocol";
import { CANCELLATION_POLICY_VERSION, CANCELLATION_SECTIONS } from "../cancellation-policy";

describe("terms content", () => {
  it("has a version string in YYYY-MM form with an optional suffix", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}(-[a-z]+)?$/);
  });
  it("has sections with titles and at least one item each", () => {
    expect(TERMS_SECTIONS.length).toBeGreaterThan(0);
    for (const section of TERMS_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});

describe("cancellation policy content", () => {
  it("is versioned and states the legal 14-day window and the fee cap", () => {
    expect(CANCELLATION_POLICY_VERSION).toMatch(/^\d{4}-\d{2}(-[a-z]+)?$/);
    const text = CANCELLATION_SECTIONS.flatMap((s) => s.items).join(" ");
    expect(text).toContain("14 ימים");
    expect(text).toContain("5%");
    expect(text).toContain("100 ש\"ח");
    expect(CANCELLATION_SECTIONS.some((s) => s.title === "איך מבטלים")).toBe(true);
  });
});

describe("safety protocol content", () => {
  it("has the seven sections of the PDF and the three emergency numbers", () => {
    expect(SAFETY_SECTIONS).toHaveLength(7);
    expect(EMERGENCY_NUMBERS.map((n) => n.number)).toEqual(["101", "100", "102"]);
  });
});
