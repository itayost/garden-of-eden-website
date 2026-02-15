import { describe, it, expect } from "vitest";
import {
  isValidUUID,
  isValidPhoneIL,
  formatPhoneToInternational,
  formatPhoneToLocal,
} from "../common";

describe("isValidUUID", () => {
  it("returns true for valid UUID v4", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("returns true for uppercase UUID", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("returns false for too-short string", () => {
    expect(isValidUUID("550e8400-e29b")).toBe(false);
  });

  it("returns false for wrong characters", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544zzzz")).toBe(false);
  });

  it("returns false for nil UUID without dashes", () => {
    expect(isValidUUID("00000000000000000000000000000000")).toBe(false);
  });

  it("returns true for nil UUID with dashes", () => {
    expect(isValidUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isValidUUID(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidUUID(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("returns false for string with extra chars", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(
      false
    );
  });
});

describe("isValidPhoneIL", () => {
  it("returns true for valid 05X format", () => {
    expect(isValidPhoneIL("0501234567")).toBe(true);
    expect(isValidPhoneIL("0521234567")).toBe(true);
    expect(isValidPhoneIL("0541234567")).toBe(true);
  });

  it("returns true for valid +972 format", () => {
    expect(isValidPhoneIL("+972501234567")).toBe(true);
  });

  it("returns false for too short", () => {
    expect(isValidPhoneIL("050123")).toBe(false);
  });

  it("returns false for too long", () => {
    expect(isValidPhoneIL("05012345678")).toBe(false);
  });

  it("returns true for non-mobile prefix (landline matches 0X regex)", () => {
    expect(isValidPhoneIL("0312345678")).toBe(true); // matches 0\d{9}
  });

  it("returns false for letters", () => {
    expect(isValidPhoneIL("050abc4567")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidPhoneIL(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidPhoneIL(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidPhoneIL("")).toBe(false);
  });
});

describe("formatPhoneToInternational", () => {
  it("converts 0XX to +972XX", () => {
    expect(formatPhoneToInternational("0501234567")).toBe("+972501234567");
  });

  it("keeps already international format", () => {
    expect(formatPhoneToInternational("+972501234567")).toBe("+972501234567");
  });

  it("converts any 0-prefix number", () => {
    expect(formatPhoneToInternational("0312345678")).toBe("+972312345678");
  });
});

describe("formatPhoneToLocal", () => {
  it("converts +972XX to 0XX", () => {
    expect(formatPhoneToLocal("+972501234567")).toBe("0501234567");
  });

  it("keeps already local format", () => {
    expect(formatPhoneToLocal("0501234567")).toBe("0501234567");
  });

  it("returns empty string for null", () => {
    expect(formatPhoneToLocal(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatPhoneToLocal(undefined)).toBe("");
  });
});
