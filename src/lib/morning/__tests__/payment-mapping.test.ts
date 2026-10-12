import { describe, expect, it } from "vitest";
import { morningIncomeRow, morningPaymentObject, receiptRemarks } from "../payment-mapping";

const DATE = "2026-09-11";

describe("morningIncomeRow", () => {
  // vatType 0 adds VAT on top for an עוסק מורשה, so the document total no
  // longer matches the payment and Morning refuses it (errorCode 2422).
  it("marks the price as VAT-included so the total equals what was paid", () => {
    expect(morningIncomeRow("מנוי חודשי - דני", 850)).toEqual({
      description: "מנוי חודשי - דני",
      quantity: 1,
      price: 850,
      currency: "ILS",
      vatType: 1,
    });
  });
});

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

  // Morning refuses a cheque (type 2) without its number, bank, branch and account.
  it("describes a cheque with every detail Morning requires", () => {
    expect(
      morningPaymentObject(
        { kind: "check", number: "1002", bank: "הפועלים", branch: "532", account: "123456" },
        850,
        DATE,
      ),
    ).toEqual({
      price: 850,
      currency: "ILS",
      date: DATE,
      type: 2,
      chequeNum: "1002",
      bankName: "הפועלים",
      bankBranch: "532",
      bankAccount: "123456",
    });
  });
});

describe("receiptRemarks", () => {
  it("carries the reference for transfers and Bit only", () => {
    expect(receiptRemarks({ kind: "transfer", reference: "9988" })).toBe("אסמכתא: 9988");
    expect(receiptRemarks({ kind: "bit", reference: null })).toBeUndefined();
    expect(receiptRemarks({ kind: "cash" })).toBeUndefined();
    // A cheque's details travel on the payment row itself.
    expect(receiptRemarks({ kind: "check", number: "1002", bank: "לאומי", branch: "800", account: "55" })).toBeUndefined();
  });
});
