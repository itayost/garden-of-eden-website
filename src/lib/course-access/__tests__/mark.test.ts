import { describe, expect, it } from "vitest";
import { markProblem } from "../mark";

const today = "2026-12-01";

describe("markProblem", () => {
  it("accepts today", () => {
    expect(markProblem("2026-12-01", today)).toBeNull();
  });
  it("accepts exactly 365 days ahead", () => {
    expect(markProblem("2027-12-01", today)).toBeNull();
  });
  it("refuses more than a year ahead", () => {
    expect(markProblem("2027-12-02", today)).toBe("עד שנה קדימה");
  });
  it("refuses a day that has passed", () => {
    expect(markProblem("2026-11-30", today)).toBe("התאריך כבר עבר");
  });
  it("refuses an impossible date", () => {
    expect(markProblem("2026-02-30", today)).toBe("תאריך לא תקין");
  });
  it("refuses text that is not a date", () => {
    expect(markProblem("tomorrow", today)).toBe("תאריך לא תקין");
  });
});
