import { describe, it, expect } from "vitest";
import { phoneVariants } from "../phone-variants";

describe("phoneVariants", () => {
  it("returns the E.164, bare, and local spellings", () => {
    expect(phoneVariants("+972501234567")).toEqual([
      "+972501234567",
      "972501234567",
      "0501234567",
    ]);
  });
  it("returns only the input when it is not an Israeli E.164 number", () => {
    expect(phoneVariants("+15551234567")).toEqual(["+15551234567"]);
  });
});
