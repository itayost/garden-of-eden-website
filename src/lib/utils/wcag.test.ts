import { describe, it, expect } from "vitest";
import { contrastRatio, meetsAA, meetsAAA, BRAND } from "./wcag";

describe("wcag contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for identical colors", () => {
    expect(contrastRatio("#0A1F0A", "#0A1F0A")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = contrastRatio("#FFFDF5", "#0A1F0A");
    const b = contrastRatio("#0A1F0A", "#FFFDF5");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("wcag — sidebar brand pairings (must stay AA or better)", () => {
  it("cream surface + forest text passes AAA (large + body)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.forest);
    expect(meetsAA(r)).toBe(true);
    expect(meetsAAA(r)).toBe(true);
  });

  it("cream surface + earth text passes AAA", () => {
    const r = contrastRatio(BRAND.cream, BRAND.earth);
    expect(meetsAAA(r)).toBe(true);
  });

  it("forest active bg + cream text passes AAA", () => {
    const r = contrastRatio(BRAND.forest, BRAND.cream);
    expect(meetsAAA(r)).toBe(true);
  });

  it("gold badge bg + earth text passes AA (admin badge)", () => {
    const r = contrastRatio(BRAND.gold, BRAND.earth);
    expect(meetsAA(r)).toBe(true);
  });
});

describe("wcag — brand colors that MUST NOT be used as text on cream", () => {
  it("grass on cream fails AA for body text (documents non-text-only constraint)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.grass);
    expect(meetsAA(r)).toBe(false);
  });

  it("gold on cream fails AA for body text (documents non-text-only constraint)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.gold);
    expect(meetsAA(r)).toBe(false);
  });
});
