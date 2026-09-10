import { describe, it, expect } from "vitest";
import { isValidIsraeliId } from "../israeli-id";

describe("isValidIsraeliId", () => {
  it("accepts valid ids, including ones that need leading zeros", () => {
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("000000018")).toBe(true);
    expect(isValidIsraeliId("18")).toBe(true);
    expect(isValidIsraeliId("12345678 2")).toBe(true);
  });
  it("rejects a wrong check digit, letters, and long inputs", () => {
    expect(isValidIsraeliId("123456781")).toBe(false);
    expect(isValidIsraeliId("12345678a")).toBe(false);
    expect(isValidIsraeliId("1234567890")).toBe(false);
    expect(isValidIsraeliId("")).toBe(false);
  });
});
