import { describe, expect, it } from "vitest";
import { morningPaymentObject, receiptRemarks } from "../payment-mapping";

const DATE = "2026-09-11";

describe("morningPaymentObject", () => {
  it("describes a Visa card with installments", () => {
    expect(
      morningPaymentObject({ kind: "card", brand: "visa", last4: "1111", installments: 3 }, 3200, DATE),
    ).toEqual({ price: 3200, currency: "ILS", date: DATE, type: 3, cardType: 2, cardNum: "1111", dealType: 2, numPayments: 3 });
  });

  it("describes cash, a bank transfer, and Bit", () => {
    expect(morningPaymentObject({ kind: "cash" }, 850, DATE)).toEqual({ price: 850, currency: "ILS", date: DATE, type: 1 });
    expect(morningPaymentObject({ kind: "transfer", reference: "9988" }, 850, DATE)).toEqual({ price: 850, currency: "ILS", date: DATE, type: 4 });
    expect(morningPaymentObject({ kind: "bit", reference: null }, 360, DATE)).toEqual({ price: 360, currency: "ILS", date: DATE, type: 10, appType: 1 });
  });
});

describe("receiptRemarks", () => {
  it("carries the reference for transfers and Bit only", () => {
    expect(receiptRemarks({ kind: "transfer", reference: "9988" })).toBe("אסמכתא: 9988");
    expect(receiptRemarks({ kind: "bit", reference: null })).toBeUndefined();
    expect(receiptRemarks({ kind: "cash" })).toBeUndefined();
  });
});
