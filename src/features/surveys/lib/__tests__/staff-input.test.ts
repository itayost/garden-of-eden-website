import { describe, expect, test } from "vitest";
import { closeDateProblem, withBlankClosesOn } from "../staff-input";

describe("withBlankClosesOn", () => {
  test("an empty close date becomes null", () => {
    expect(withBlankClosesOn({ title: "סקר", closesOn: "" })).toEqual({ title: "סקר", closesOn: null });
  });

  test("a spaces-only close date becomes null", () => {
    expect(withBlankClosesOn({ closesOn: "   " })).toEqual({ closesOn: null });
  });

  test("a real date and null are left alone", () => {
    expect(withBlankClosesOn({ closesOn: "2026-11-05" })).toEqual({ closesOn: "2026-11-05" });
    expect(withBlankClosesOn({ closesOn: null })).toEqual({ closesOn: null });
  });

  test("the other fields are kept and the input is not changed", () => {
    const input = { title: "סקר", intro: "", closesOn: "" };
    const result = withBlankClosesOn(input);
    expect(result).toEqual({ title: "סקר", intro: "", closesOn: null });
    expect(input.closesOn).toBe("");
  });

  test("anything that is not an object passes through for the schema to refuse", () => {
    expect(withBlankClosesOn(null)).toBeNull();
    expect(withBlankClosesOn("x")).toBe("x");
  });
});

describe("closeDateProblem", () => {
  const today = "2026-10-29";

  test("no close date is fine", () => {
    expect(closeDateProblem("2026-10-01", null, today)).toBeNull();
  });

  test("today and later are fine for a survey that already opened", () => {
    expect(closeDateProblem("2026-10-01", "2026-10-29", today)).toBeNull();
    expect(closeDateProblem("2026-10-01", "2026-12-01", today)).toBeNull();
  });

  test("a day before today has passed", () => {
    expect(closeDateProblem("2026-10-01", "2026-10-28", today)).toBe("תאריך הסגירה כבר עבר");
  });

  test("a survey opening later closes on or after its opening day", () => {
    expect(closeDateProblem("2026-11-05", "2026-11-05", today)).toBeNull();
    expect(closeDateProblem("2026-11-05", "2026-11-04", today)).toBe("תאריך הסגירה לפני תאריך הפתיחה");
  });

  test("a date that is both before today and before the opening has passed", () => {
    expect(closeDateProblem("2026-11-05", "2026-10-20", today)).toBe("תאריך הסגירה כבר עבר");
  });
});
