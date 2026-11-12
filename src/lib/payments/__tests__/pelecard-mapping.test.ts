import { describe, expect, it } from "vitest";
import { normalizeCode, pelecardParamX, pickStored, toAgorot } from "../pelecard-mapping";

const ORDER_ID = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";

describe("toAgorot", () => {
  it("converts shekels to whole agorot without float drift", () => {
    expect(toAgorot(450)).toBe(45000);
    expect(toAgorot(19.99)).toBe(1999);
    expect(toAgorot(0.1 + 0.2)).toBe(30);
  });
});

describe("pelecardParamX", () => {
  it("fits Pelecard's 19 character limit and is stable per order", () => {
    const ref = pelecardParamX(ORDER_ID);
    expect(ref).toHaveLength(19);
    expect(ref).toBe("3f2b8c1e9a4d4e21b7c");
    expect(pelecardParamX(ORDER_ID)).toBe(ref);
  });
});

describe("normalizeCode", () => {
  it("reads Pelecard and Shva codes as three digits", () => {
    expect(normalizeCode("000")).toBe("000");
    expect(normalizeCode(0)).toBe("000");
    expect(normalizeCode("36")).toBe("036");
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("abc")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });
});

describe("pickStored", () => {
  it("keeps support fields and drops card data", () => {
    const stored = pickStored({
      PelecardTransactionId: 254379665,
      DebitApproveNumber: "1234567",
      CreditCardNumber: "45******4580",
      CreditCardExpDate: "0328",
      shvaOutput: "0000",
    });
    expect(stored).toEqual({ PelecardTransactionId: 254379665, DebitApproveNumber: "1234567" });
  });
});
