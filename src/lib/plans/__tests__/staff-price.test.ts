import { describe, expect, it } from "vitest";
import { staffSalePrice } from "../staff-price";

const none = { discount: null, manualCard: null, freeReason: null };

describe("staffSalePrice", () => {
  it("charges the list price for a plain sale", () => {
    expect(staffSalePrice(450, none)).toEqual({ ok: true, paid: 450, listPrice: null, reason: null });
  });

  it("charges a Discount's amount and keeps the list price and reason", () => {
    expect(staffSalePrice(450, { ...none, discount: { amountIls: 400, reason: "אח שני" } })).toEqual({
      ok: true,
      paid: 400,
      listPrice: 450,
      reason: "אח שני",
    });
  });

  it("charges a manual Card's typed price", () => {
    expect(staffSalePrice(1, { ...none, manualCard: { sessions: 8, priceIls: 640, days: 60 } })).toEqual({
      ok: true,
      paid: 640,
      listPrice: null,
      reason: null,
    });
  });

  it("charges nothing for a free sale, keeping what it was worth and why", () => {
    expect(staffSalePrice(450, { ...none, freeReason: "שבוע ניסיון" })).toEqual({
      ok: true,
      paid: 0,
      listPrice: 450,
      reason: "שבוע ניסיון",
    });
    expect(staffSalePrice(1, { ...none, manualCard: { sessions: 8, priceIls: 640, days: 60 }, freeReason: "מלגה" })).toEqual({
      ok: true,
      paid: 0,
      listPrice: 640,
      reason: "מלגה",
    });
  });

  it("refuses a Discount on a manual Card or a free sale, and passes on the rules' refusals", () => {
    expect(staffSalePrice(450, { ...none, freeReason: "x".repeat(2), discount: { amountIls: 400, reason: "אח" } }).ok).toBe(false);
    expect(staffSalePrice(1, { ...none, manualCard: { sessions: 8, priceIls: 640, days: 60 }, discount: { amountIls: 1, reason: "אח" } }).ok).toBe(false);
    expect(staffSalePrice(450, { ...none, discount: { amountIls: 500, reason: "אח" } })).toEqual({
      ok: false,
      problem: "הסכום לתשלום צריך להיות נמוך ממחיר המחירון",
    });
  });
});
