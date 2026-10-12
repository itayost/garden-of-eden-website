import { describe, expect, it } from "vitest";

import { chequeDetails } from "../cheque";

const BANK = { bank: "הפועלים", branch: "532", account: "123456" };

describe("chequeDetails", () => {
  it("takes a cheque's number from the reference and trims every field", () => {
    expect(chequeDetails("check", " 1002 ", { bank: " הפועלים ", branch: " 532", account: "12-3456 " })).toEqual({
      ok: true,
      details: { number: "1002", bank: "הפועלים", branch: "532", account: "12-3456" },
    });
  });

  it("drops leftover cheque fields when another method was chosen", () => {
    expect(chequeDetails("cash", "1002", BANK)).toEqual({ ok: true, details: null });
    expect(chequeDetails("transfer", "9988", null)).toEqual({ ok: true, details: null });
  });

  it("refuses a cheque without its number", () => {
    expect(chequeDetails("check", null, BANK)).toEqual({ ok: false, problem: "נדרש מספר הצ׳ק" });
    expect(chequeDetails("check", "  ", BANK)).toEqual({ ok: false, problem: "נדרש מספר הצ׳ק" });
  });

  it("refuses a cheque without its bank, branch or account", () => {
    expect(chequeDetails("check", "1002", null)).toEqual({ ok: false, problem: "נדרש שם הבנק" });
    expect(chequeDetails("check", "1002", { ...BANK, bank: " " })).toEqual({ ok: false, problem: "נדרש שם הבנק" });
    expect(chequeDetails("check", "1002", { ...BANK, branch: "" })).toEqual({ ok: false, problem: "נדרש מספר הסניף" });
    expect(chequeDetails("check", "1002", { ...BANK, account: "" })).toEqual({ ok: false, problem: "נדרש מספר החשבון" });
  });

  it("refuses numbers that are not numbers", () => {
    expect(chequeDetails("check", "10a2", BANK)).toEqual({ ok: false, problem: "מספר הצ׳ק: ספרות בלבד" });
    expect(chequeDetails("check", "1002", { ...BANK, branch: "5-3" })).toEqual({ ok: false, problem: "מספר הסניף: ספרות בלבד" });
    expect(chequeDetails("check", "1002", { ...BANK, account: "12x" })).toEqual({ ok: false, problem: "מספר החשבון: ספרות ומקף בלבד" });
  });

  it("refuses values longer than the order can store", () => {
    expect(chequeDetails("check", "1".repeat(21), BANK).ok).toBe(false);
    expect(chequeDetails("check", "1002", { ...BANK, bank: "א".repeat(41) }).ok).toBe(false);
    expect(chequeDetails("check", "1002", { ...BANK, branch: "1".repeat(11) }).ok).toBe(false);
    expect(chequeDetails("check", "1002", { ...BANK, account: "1".repeat(21) }).ok).toBe(false);
  });
});
