import { describe, expect, it } from "vitest";
import { awaitsCard, payPath } from "../payment-link";

describe("awaitsCard", () => {
  it("waits for a Payment link not yet paid, expired included", () => {
    expect(awaitsCard({ payment_link_by: "staff", status: "pending" })).toBe(true);
    expect(awaitsCard({ payment_link_by: "staff", status: "expired" })).toBe(true);
  });

  it("does not wait for a paid link, nor for an order no one sent as a link", () => {
    expect(awaitsCard({ payment_link_by: "staff", status: "paid" })).toBe(false);
    expect(awaitsCard({ payment_link_by: null, status: "pending" })).toBe(false);
  });

  it("points at the card page", () => {
    expect(payPath("abc")).toBe("/join/pay/abc");
  });
});
