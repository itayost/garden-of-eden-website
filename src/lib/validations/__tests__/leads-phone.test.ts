import { describe, expect, it } from "vitest";
import { leadPhoneSearchFragment, normalizeLeadPhone } from "../leads";

describe("normalizeLeadPhone", () => {
  it("normalizes a local 05x number to 972 format", () => {
    expect(normalizeLeadPhone("050-1234567")).toBe("972501234567");
  });

  it("normalizes a 5xxxxxxxx number to 972 format", () => {
    expect(normalizeLeadPhone("501234567")).toBe("972501234567");
  });

  it("keeps an already-normalized 972 number", () => {
    expect(normalizeLeadPhone("972501234567")).toBe("972501234567");
  });

  it("returns null for unrecognizable input", () => {
    expect(normalizeLeadPhone("123")).toBeNull();
  });
});

describe("leadPhoneSearchFragment", () => {
  it("drops a single leading zero from a typed local number", () => {
    // "050-1234567" -> stored "972501234567" contains "501234567"
    expect(leadPhoneSearchFragment("050-1234567")).toBe("501234567");
  });

  it("strips non-digit characters", () => {
    expect(leadPhoneSearchFragment("050 123 4567")).toBe("501234567");
    expect(leadPhoneSearchFragment("+972-50-123-4567")).toBe("972501234567");
  });

  it("matches a partial local number against the stored 972 value", () => {
    const fragment = leadPhoneSearchFragment("0501234");
    expect(fragment).toBe("501234");
    expect("972501234567".includes(fragment)).toBe(true);
  });

  it("leaves a 972-prefixed number untouched (after digit stripping)", () => {
    expect(leadPhoneSearchFragment("972501234567")).toBe("972501234567");
  });

  it("returns an empty string when there are no digits", () => {
    expect(leadPhoneSearchFragment("abc")).toBe("");
    expect(leadPhoneSearchFragment("")).toBe("");
  });
});
