import { describe, expect, it } from "vitest";
import { GENDER_LABELS, parseGender } from "../gender";

describe("parseGender", () => {
  it("passes the two stored values through", () => {
    expect(parseGender("male")).toBe("male");
    expect(parseGender("female")).toBe("female");
  });

  it("reads Arbox spellings with case and spaces", () => {
    expect(parseGender(" Female ")).toBe("female");
    expect(parseGender("MALE")).toBe("male");
  });

  it("gives null for anything else", () => {
    for (const value of ["", "other", "m", null, undefined, 1, {}]) {
      expect(parseGender(value)).toBeNull();
    }
  });
});

describe("GENDER_LABELS", () => {
  it("names each value the way the forms ask", () => {
    expect(GENDER_LABELS).toEqual({ male: "בן", female: "בת" });
  });
});
