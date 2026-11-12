import { describe, it, expect } from "vitest";
import { TERMS_SECTIONS, TERMS_VERSION } from "../terms-kiryat-ata";
import { BRANCH_TERMS, PLANS_SECTION_TITLE, termsFor } from "../terms";
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

describe("terms per branch", () => {
  const all = Object.values(BRANCH_TERMS);

  it("gives every branch a well-formed version of its own", () => {
    for (const terms of all) expect(terms.version).toMatch(/^\d{4}-\d{2}(-[a-z]+)?$/);
    expect(new Set(all.map((t) => t.version)).size).toBe(all.length);
  });

  it("differs between branches only in the plans section", () => {
    const rest = (key: keyof typeof BRANCH_TERMS) =>
      BRANCH_TERMS[key].sections.filter((s) => s.title !== PLANS_SECTION_TITLE);
    expect(rest("haifa")).toEqual(rest("kiryat_ata"));
    for (const terms of all) expect(terms.sections[0].title).toBe(PLANS_SECTION_TITLE);
  });

  it("keeps קריית אתא on the terms its parents have signed so far", () => {
    expect(termsFor("kiryat_ata")).toEqual(expect.objectContaining({ version: TERMS_VERSION, sections: TERMS_SECTIONS }));
  });

  it("falls back to the קריית אתא terms for a branch without its own", () => {
    expect(termsFor(null)).toBe(BRANCH_TERMS.kiryat_ata);
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
