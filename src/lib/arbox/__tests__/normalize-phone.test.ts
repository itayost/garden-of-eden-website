import { describe, it, expect } from "vitest";
import { normalizePhone } from "../normalize-phone";

describe("normalizePhone", () => {
  it("converts 05x local format to E.164", () => {
    expect(normalizePhone("0521234567")).toBe("+972521234567");
  });

  it("strips dashes from local format", () => {
    expect(normalizePhone("052-123-4567")).toBe("+972521234567");
  });

  it("strips spaces from local format", () => {
    expect(normalizePhone("052 123 4567")).toBe("+972521234567");
  });

  it("keeps already-normalized E.164 unchanged", () => {
    expect(normalizePhone("+972521234567")).toBe("+972521234567");
  });

  it("adds + to 972-prefixed number missing it", () => {
    expect(normalizePhone("972521234567")).toBe("+972521234567");
  });

  it("returns null for null input", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("returns null for non-Israeli number", () => {
    expect(normalizePhone("12025551234")).toBeNull();
  });
});
