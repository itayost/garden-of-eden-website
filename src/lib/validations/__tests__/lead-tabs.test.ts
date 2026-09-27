import { describe, expect, it } from "vitest";
import { deriveLeadTabSlug, nextFreeLeadTabSlug } from "../lead-tabs";

describe("deriveLeadTabSlug", () => {
  it("collapses whitespace and punctuation into single dashes", () => {
    expect(deriveLeadTabSlug("Campaign  – 2026!")).toBe("campaign-2026");
  });

  it("falls back to 'tab' when the input has no slug-safe characters", () => {
    expect(deriveLeadTabSlug("!!!")).toBe("tab");
    expect(deriveLeadTabSlug("   ")).toBe("tab");
    expect(deriveLeadTabSlug("ממומנים")).toBe("tab");
  });

  it("limits the slug to 50 characters", () => {
    const long = "a".repeat(80);
    expect(deriveLeadTabSlug(long)).toHaveLength(50);
  });

  it("never emits leading or trailing dashes/underscores", () => {
    expect(deriveLeadTabSlug("--hello--")).toBe("hello");
    expect(deriveLeadTabSlug("__hi__")).toBe("hi");
  });

  it("lowercases the output", () => {
    expect(deriveLeadTabSlug("PAID")).toBe("paid");
  });
});

describe("nextFreeLeadTabSlug", () => {
  it("keeps the base when nobody has it", () => {
    expect(nextFreeLeadTabSlug("organic", new Set(["paid"]))).toBe("organic");
  });

  it("skips slugs held by deleted tabs too", () => {
    // The DB unique index covers soft-deleted rows, so a deleted tab's slug
    // is still taken (production: "tab-2" belongs to a deleted tab).
    const taken = new Set(["tab", "tab-2", "tab-3", "tab-4", "tab-5", "tab-6", "tab-7"]);

    expect(nextFreeLeadTabSlug("tab", taken)).toBe("tab-8");
  });

  it("stays within 50 characters", () => {
    const base = "a".repeat(50);

    const slug = nextFreeLeadTabSlug(base, new Set([base]));

    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug).not.toBe(base);
  });

  it("skips a shortened candidate that is already taken", () => {
    const base = "a".repeat(50);
    const taken = new Set([base, `${"a".repeat(48)}-2`]);

    expect(nextFreeLeadTabSlug(base, taken)).toBe(`${"a".repeat(48)}-3`);
  });
});
