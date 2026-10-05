import { describe, expect, it } from "vitest";
import { NO_DISCOUNT, capturedPriceHolds, discountProblem, readDiscount } from "../discount";

describe("discountProblem", () => {
  it("accepts an amount below the list price, in shekels and agorot", () => {
    expect(discountProblem(450, 400)).toBeNull();
    expect(discountProblem(450, 399.5)).toBeNull();
  });

  it("refuses the list price or more: that is no discount", () => {
    expect(discountProblem(450, 450)).toBe("הסכום לתשלום צריך להיות נמוך ממחיר המחירון");
    expect(discountProblem(450, 500)).toBe("הסכום לתשלום צריך להיות נמוך ממחיר המחירון");
  });

  it("refuses nothing to pay and fractions of an agora", () => {
    expect(discountProblem(450, 0)).toBe("הסכום לתשלום חייב להיות גדול מ-0");
    expect(discountProblem(450, -10)).toBe("הסכום לתשלום חייב להיות גדול מ-0");
    expect(discountProblem(450, 99.999)).toBe("סכום בשקלים ובאגורות בלבד");
  });
});

describe("readDiscount", () => {
  it("sends nothing while the discount is off", () => {
    expect(readDiscount({ on: false, amount: "100", reason: "" }, 450)).toEqual({ discount: null, problem: null });
    expect(readDiscount(NO_DISCOUNT, 450)).toEqual({ discount: null, problem: null });
  });

  it("asks for the amount before anything else", () => {
    expect(readDiscount({ on: true, amount: "", reason: "אח שני" }, 450).problem).toBe("נדרש הסכום לתשלום");
    expect(readDiscount({ on: true, amount: "  ", reason: "אח שני" }, 450).problem).toBe("נדרש הסכום לתשלום");
  });

  it("applies the amount rule, then asks for a reason", () => {
    expect(readDiscount({ on: true, amount: "450", reason: "אח שני" }, 450).problem).toBe(
      "הסכום לתשלום צריך להיות נמוך ממחיר המחירון",
    );
    expect(readDiscount({ on: true, amount: "400", reason: " א " }, 450).problem).toBe("נדרשת סיבה");
  });

  it("sends the amount and the trimmed reason", () => {
    expect(readDiscount({ on: true, amount: "399.5", reason: "  מלגה  " }, 450)).toEqual({
      discount: { amountIls: 399.5, reason: "מלגה" },
      problem: null,
    });
  });
});

describe("capturedPriceHolds", () => {
  it("holds for an order at the product's list price", () => {
    expect(capturedPriceHolds(450, { amountIls: 450, listPriceIls: null })).toBe(true);
  });

  it("holds for a discounted order whose list price is still the product's", () => {
    expect(capturedPriceHolds(450, { amountIls: 400, listPriceIls: 450 })).toBe(true);
  });

  it("fails when the product's price changed since the order was made", () => {
    expect(capturedPriceHolds(500, { amountIls: 450, listPriceIls: null })).toBe(false);
    expect(capturedPriceHolds(500, { amountIls: 400, listPriceIls: 450 })).toBe(false);
  });
});

describe("capturedPriceHolds for a manual Card", () => {
  it("holds whatever the placeholder product costs: staff set the price", () => {
    expect(capturedPriceHolds(1, { amountIls: 640, listPriceIls: null, staffTerms: true })).toBe(true);
  });
});
