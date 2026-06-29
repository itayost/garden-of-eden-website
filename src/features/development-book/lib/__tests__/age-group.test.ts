import { describe, it, expect } from "vitest";
import { deriveAgeGroup } from "../age-group";

const NOW = new Date("2026-06-29T00:00:00Z");

describe("deriveAgeGroup", () => {
  it("returns null for null birthdate", () => {
    expect(deriveAgeGroup(null, NOW)).toBeNull();
  });
  it("maps an 11 year old to U10-12", () => {
    expect(deriveAgeGroup("2015-01-01", NOW)).toBe("U10-12");
  });
  it("maps a 13 year old to U13-14", () => {
    expect(deriveAgeGroup("2013-01-01", NOW)).toBe("U13-14");
  });
  it("maps a 16 year old to U15-16", () => {
    expect(deriveAgeGroup("2010-01-01", NOW)).toBe("U15-16");
  });
  it("maps an 18 year old to U17+", () => {
    expect(deriveAgeGroup("2008-01-01", NOW)).toBe("U17+");
  });
  it("clamps a 7 year old to U10-12", () => {
    expect(deriveAgeGroup("2019-01-01", NOW)).toBe("U10-12");
  });
});
