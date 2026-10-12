import { describe, expect, test } from "vitest";

import { birthYearOf, rosterName, shortBirthYear } from "../roster-name";

describe("birthYearOf", () => {
  test("reads the year off an ISO birthdate", () => {
    expect(birthYearOf("2008-03-14")).toBe(2008);
  });

  test("is null when the birthdate is missing", () => {
    expect(birthYearOf(null)).toBeNull();
  });

  test("is null when the birthdate is not a date", () => {
    expect(birthYearOf("")).toBeNull();
    expect(birthYearOf("abcd-01-01")).toBeNull();
  });
});

describe("shortBirthYear", () => {
  test("is the last two digits of the year", () => {
    expect(shortBirthYear(2008)).toBe("08");
    expect(shortBirthYear(2015)).toBe("15");
  });

  test("is null when the year is unknown", () => {
    expect(shortBirthYear(null)).toBeNull();
    expect(shortBirthYear(undefined)).toBeNull();
  });
});

describe("rosterName", () => {
  test("adds the two-digit birth year after the name", () => {
    expect(rosterName({ trainee_name: "יונתן", birth_year: 2008 })).toBe("יונתן 08");
  });

  test("keeps the leading zero for years after 2000", () => {
    expect(rosterName({ trainee_name: "נועם לוי", birth_year: 2015 })).toBe("נועם לוי 15");
    expect(rosterName({ trainee_name: "נועם לוי", birth_year: 2001 })).toBe("נועם לוי 01");
  });

  test("leaves the name bare when the year is unknown", () => {
    expect(rosterName({ trainee_name: "יונתן", birth_year: null })).toBe("יונתן");
    expect(rosterName({ trainee_name: "יונתן" })).toBe("יונתן");
  });
});
