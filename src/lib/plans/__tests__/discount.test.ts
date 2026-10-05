import { describe, expect, it } from "vitest";
import { discountProblem } from "../discount";

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
