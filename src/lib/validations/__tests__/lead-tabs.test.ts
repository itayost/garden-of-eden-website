import { describe, expect, it } from "vitest";
import { deriveLeadTabSlug } from "../lead-tabs";

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
