import { describe, expect, it } from "vitest";
import { paidNothing } from "../paid";

describe("paidNothing", () => {
  it("is true for an order at 0, as the database stores it or as a number", () => {
    expect(paidNothing({ amount_ils: 0 })).toBe(true);
    expect(paidNothing({ amount_ils: "0.00" })).toBe(true);
  });

  it("is false for any order that cost something", () => {
    expect(paidNothing({ amount_ils: 450 })).toBe(false);
    expect(paidNothing({ amount_ils: "0.50" })).toBe(false);
  });
});
