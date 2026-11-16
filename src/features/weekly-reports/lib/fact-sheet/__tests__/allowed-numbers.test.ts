import { describe, expect, test } from "vitest";
import { allowedNumbers, allowedNumbersIn, foreignDigitsIn, normalizeNumber, numbersIn } from "../allowed-numbers";
import { buildFactSheet } from "../build";
import { emptyWeek } from "./fixtures";

describe("normalizeNumber", () => {
  test.each([
    ["7,50", "7.5"],
    ["08", "8"],
    ["00", "0"],
    ["7", "7"],
    ["3.0", "3"],
    ["0.10", "0.1"],
    ["120", "120"],
  ])("%s reads %s", (raw, expected) => expect(normalizeNumber(raw)).toBe(expected));
});

describe("numbersIn", () => {
  test("every number in a text, normalized", () => {
    expect(numbersIn("ישן 7,5 שעות ב-08:00")).toEqual(["7.5", "8", "0"]);
  });

  test("a text with no digits has none", () => {
    expect(numbersIn("{שם} השקיע מאוד השבוע")).toEqual([]);
  });

  test("a thousands separator is read as one whole number, never as a decimal point", () => {
    expect(numbersIn("רץ 3,000 מטר ו-12,000 צעדים")).toEqual(["3000", "12000"]);
    expect(numbersIn("2.000 קפיצות")).toEqual(["2000"]);
    expect(numbersIn("1 000 קפיצות")).toEqual(["1000"]);
    expect(numbersIn("1,250,000")).toEqual(["1250000"]);
  });

  test("one or two digits after the separator stay a decimal", () => {
    expect(numbersIn("7.5 ו-7,50 ו-13.11")).toEqual(["7.5", "7.5", "13.11"]);
  });
});

describe("foreignDigitsIn", () => {
  test("finds digits outside 0 to 9", () => {
    expect(foreignDigitsIn("רץ \u0663 קילומטר")).toBe(true);
    expect(foreignDigitsIn("רץ \uFF13 קילומטר")).toBe(true);
  });

  test("plain digits and no digits pass", () => {
    expect(foreignDigitsIn("רץ 3 קילומטר")).toBe(false);
    expect(foreignDigitsIn("{שם} השקיע")).toBe(false);
  });
});

describe("allowedNumbers", () => {
  const { sheet } = buildFactSheet(
    emptyWeek({
      checkins: [
        { date: "2026-11-14", sleepHours: 7, energy: 3, soreness: false },
        { date: "2026-11-15", sleepHours: 8, energy: 4, soreness: false },
      ],
      roster: [
        { date: "2026-11-17", startTime: "17:00", focus: null, slotId: "slot-1", counts: true, lateCancel: false, trainerFirstNames: [] },
      ],
      tags: [{ slotId: "slot-1", date: "2026-11-17", tag: "effort" }],
      notes: [{ slotId: "slot-1", date: "2026-11-17", note: "3 סטים" }],
      drillCandidates: [
        {
          id: "4b3f9a21-0c55-4e77-9d1e-777777777777",
          name: "סט של 65 קפיצות",
          why: "בונה 35 אחוז יותר כוח",
          goal: "ספרינט 10 מטר",
        },
      ],
    }),
  );
  const allowed = allowedNumbers(sheet);

  test("holds a habits average and a number inside a note", () => {
    expect(allowed.has("7.5")).toBe(true);
    expect(allowed.has("3")).toBe(true);
  });

  test("holds the attendance count and the dates", () => {
    expect(allowed.has("1")).toBe(true);
    expect(allowed.has("17")).toBe(true);
  });

  test("holds the number of drills", () => {
    expect(allowed.has(String(sheet.drills.length))).toBe(true);
  });

  test("a drill id adds no digits", () => {
    expect(allowed.has("777777777777")).toBe(false);
    expect(allowed.has("21")).toBe(false);
  });

  test("a number the sheet never mentions is not allowed", () => {
    expect(allowed.has("42")).toBe(false);
    expect(allowed.has("8.5")).toBe(false);
  });

  test("the age group's number is a fact too", () => {
    expect(allowed.has("12")).toBe(true);
  });

  test("a number that appears only in a drill's name or 'למה' line is not allowed", () => {
    expect(allowed.has("65")).toBe(false);
    expect(allowed.has("35")).toBe(false);
    expect(allowed.has(String(sheet.drills.length))).toBe(true);
  });

  test("a number that appears only in a drill's Goal label is not allowed", () => {
    expect(allowed.has("10")).toBe(false);
  });
});

describe("allowedNumbersIn", () => {
  test("every number in a value, fields named id skipped", () => {
    const allowed = allowedNumbersIn({ id: "7", value: 2.05 });
    expect(allowed.has("2.05")).toBe(true);
    expect(allowed.has("7")).toBe(false);
  });

  test("numbers inside nested strings and arrays count", () => {
    const allowed = allowedNumbersIn({ facts: ["ממוצע 7,5 שעות"], nested: { count: 3 } });
    expect([...allowed].sort()).toEqual(["3", "7.5"]);
  });
});
