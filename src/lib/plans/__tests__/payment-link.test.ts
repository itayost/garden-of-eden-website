import { describe, expect, it } from "vitest";
import { awaitsCard, payPath } from "../payment-link";

describe("awaitsCard", () => {
  it("waits for a card order not yet paid, expired included", () => {
    expect(awaitsCard({ payment_provider: "isracard", status: "pending" })).toBe(true);
    expect(awaitsCard({ payment_provider: "morning", status: "expired" })).toBe(true);
  });

  it("does not wait for a paid order or one staff took by hand", () => {
    expect(awaitsCard({ payment_provider: "isracard", status: "paid" })).toBe(false);
    expect(awaitsCard({ payment_provider: "manual", status: "pending" })).toBe(false);
  });

  it("points at the card page", () => {
    expect(payPath("abc")).toBe("/join/pay/abc");
  });
});
