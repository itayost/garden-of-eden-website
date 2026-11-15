import { describe, expect, it } from "vitest";
import { genderField, optionalGenderField } from "../gender";

describe("genderField", () => {
  it("accepts either value", () => {
    expect(genderField.parse("male")).toBe("male");
    expect(genderField.parse("female")).toBe("female");
  });

  it("asks for a choice when none was made", () => {
    for (const value of [undefined, ""]) {
      const result = genderField.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("יש לבחור בן או בת");
    }
  });
});

describe("optionalGenderField", () => {
  it("accepts an empty choice and both values", () => {
    for (const value of ["", "male", "female"]) {
      expect(optionalGenderField.safeParse(value).success).toBe(true);
    }
  });

  it("refuses anything else", () => {
    expect(optionalGenderField.safeParse("other").success).toBe(false);
  });
});
