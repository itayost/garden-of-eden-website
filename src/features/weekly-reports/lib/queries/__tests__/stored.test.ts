import { describe, expect, test } from "vitest";
import { buildFactSheet } from "../../fact-sheet/build";
import { emptyWeek } from "../../fact-sheet/__tests__/fixtures";
import { holdReasonsOf, offeredDrillIds, storedSheetOf, toJson } from "../stored";

const DRILL = "33333333-3333-4333-8333-333333333333";

function builtWeek() {
  return buildFactSheet(
    emptyWeek({
      roster: [
        { date: "2026-11-17", startTime: "17:00", focus: "מהירות", slotId: "slot-1", counts: true, lateCancel: false, trainerFirstNames: ["יוסי"] },
      ],
      measurement: {
        inWeek: { measurement_date: "2026-11-16", weight_kg: 41.2, height_cm: 151, bmi: 18.1, bmi_percentile: 55, height_percentile: 60 },
        previous: null,
      },
      dietitianNote: "לשתות יותר מים",
    }),
  );
}

describe("toJson", () => {
  test("gives what JSON.stringify keeps: undefined fields drop, non-finite numbers become null", () => {
    const value = { a: 1, b: undefined, c: [1, Number.NaN, "x"], d: { e: Infinity, f: null, g: true } };
    expect(toJson(value)).toEqual({ a: 1, c: [1, null, "x"], d: { e: null, f: null, g: true } });
  });

  test("a built Fact sheet survives unchanged", () => {
    const { sheet, body } = builtWeek();
    expect(toJson({ sheet, body })).toEqual(JSON.parse(JSON.stringify({ sheet, body })));
  });
});

describe("storedSheetOf", () => {
  test("reads back what was stored", () => {
    const { sheet, body } = builtWeek();
    expect(storedSheetOf(toJson({ sheet, body }))).toEqual({ sheet, body });
  });

  test("a stored sheet with no body reads back with a null body", () => {
    const { sheet } = builtWeek();
    expect(storedSheetOf(toJson({ sheet, body: null }))).toEqual({ sheet, body: null });
  });

  test("null, another version or a broken sheet give null", () => {
    const { sheet } = builtWeek();
    expect(storedSheetOf(null)).toBeNull();
    expect(storedSheetOf(toJson({ sheet: { ...sheet, version: 2 }, body: null }))).toBeNull();
    expect(storedSheetOf(toJson({ sheet: { ...sheet, attendance: null }, body: null }))).toBeNull();
    expect(storedSheetOf(toJson({ sheet: { ...sheet, workedOn: "x" }, body: null }))).toBeNull();
    expect(storedSheetOf(toJson({ body: null }))).toBeNull();
    expect(storedSheetOf(toJson([sheet]))).toBeNull();
  });

  test("a body that is not one gives null", () => {
    const { sheet } = builtWeek();
    expect(storedSheetOf(toJson({ sheet, body: { weightKg: 40 } }))).toBeNull();
  });
});

describe("holdReasonsOf", () => {
  test("keeps the known reasons in order", () => {
    const reasons = [
      { code: "sensitive", text: "דוח משמרת מ-17/11 מציין פציעות" },
      { code: "number", text: "מספר שלא מופיע בנתונים: 7" },
    ];
    expect(holdReasonsOf(toJson(reasons))).toEqual(reasons);
  });

  test("drops what is not a reason", () => {
    const stored = toJson([
      { code: "nonsense", text: "x" },
      { code: "manual" },
      { code: "manual", text: 3 },
      "manual",
      null,
      { code: "manual", text: "עוכב ידנית", extra: true },
    ]);
    expect(holdReasonsOf(stored)).toEqual([{ code: "manual", text: "עוכב ידנית" }]);
  });

  test("anything but an array gives no reasons", () => {
    expect(holdReasonsOf(null)).toEqual([]);
    expect(holdReasonsOf(toJson({ code: "manual", text: "x" }))).toEqual([]);
  });
});

describe("offeredDrillIds", () => {
  test("keeps only the offered drills, once each, in the model's order", () => {
    const { sheet } = builtWeek();
    const offered = { ...sheet, drills: [{ id: DRILL, name: "קפיצות", why: null, goal: "ספרינט 10 מטר" }] };
    expect(offeredDrillIds(offered, ["made-up", DRILL, DRILL])).toEqual([DRILL]);
    expect(offeredDrillIds(sheet, [DRILL])).toEqual([]);
  });
});
