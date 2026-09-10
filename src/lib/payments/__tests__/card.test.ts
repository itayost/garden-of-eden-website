import { describe, expect, it } from "vitest";
import {
  cardNumberValid,
  detectBrand,
  expiryValid,
  formatCardNumber,
  isracardValid,
  last4,
  luhnValid,
} from "../card";

describe("luhnValid", () => {
  it("accepts the standard test numbers and rejects a changed digit", () => {
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("5555555555554444")).toBe(true);
    expect(luhnValid("378282246310005")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
  });
});

describe("isracardValid", () => {
  it("accepts a 9 digit number whose weighted sum divides by 11", () => {
    // 1 2 3 4 5 6 7 8 x: weights 9..1. 1*9+2*8+3*7+4*6+5*5+6*4+7*3+8*2 = 156; need x with 156+x % 11 == 0 -> x = 9.
    expect(isracardValid("123456789")).toBe(true);
    expect(isracardValid("123456788")).toBe(false);
  });
  it("pads 8 digit numbers with a leading zero", () => {
    // 0 1 2 3 4 5 6 7 x: 1*8+2*7+3*6+4*5+5*4+6*3+7*2 = 112; 112 + x % 11 == 0 -> x = 9.
    expect(isracardValid("12345679")).toBe(true);
    expect(isracardValid("12345678")).toBe(false);
  });
});

describe("cardNumberValid and detectBrand", () => {
  it("accepts either scheme and names the brand", () => {
    expect(cardNumberValid("4111111111111111")).toBe(true);
    expect(cardNumberValid("123456789")).toBe(true);
    expect(detectBrand("4111111111111111")).toBe("visa");
    expect(detectBrand("5555555555554444")).toBe("mastercard");
    expect(detectBrand("378282246310005")).toBe("amex");
    expect(detectBrand("123456789")).toBe("isracard");
    expect(detectBrand("9999")).toBe("unknown");
  });
});

describe("expiryValid", () => {
  const now = new Date(2026, 8, 10);
  it("rejects past months and far future years, accepts 2 or 4 digit years", () => {
    expect(expiryValid(9, 26, now)).toBe(true);
    expect(expiryValid(8, 2026, now)).toBe(false);
    expect(expiryValid(1, 2027, now)).toBe(true);
    expect(expiryValid(13, 2027, now)).toBe(false);
    expect(expiryValid(1, 2050, now)).toBe(false);
  });
});

describe("formatting helpers", () => {
  it("groups digits and keeps the last four", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(last4("4111 1111 1111 1111")).toBe("1111");
  });
});
