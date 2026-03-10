import { describe, it, expect } from "vitest";
import { isValidUUID } from "../uuid";

describe("isValidUUID", () => {
  it("returns true for valid UUID v4", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("returns true for another valid UUID", () => {
    expect(isValidUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("returns false for random string", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
  });

  it("returns false for incomplete UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
  });

  it("returns false for UUID with extra characters", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(
      false
    );
  });

  it("returns false for UUID without hyphens", () => {
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
  });
});
