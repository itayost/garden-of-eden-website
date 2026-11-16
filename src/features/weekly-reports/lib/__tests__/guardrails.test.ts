import { describe, expect, test } from "vitest";
import { buildFactSheet } from "../fact-sheet/build";
import type { HoldReason } from "../fact-sheet/types";
import { emptyWeek } from "../fact-sheet/__tests__/fixtures";
import { MAX_DRILLS, replaceTextProblems, reportProblems } from "../guardrails";
import type { WriterOutput } from "../writer/output";

const base = emptyWeek();
const week = emptyWeek({
  profile: { ...base.profile, ageGroup: "U15" },
  checkins: [
    { date: "2026-11-14", sleepHours: 7, energy: 3, soreness: false },
    { date: "2026-11-15", sleepHours: 8, energy: 4, soreness: false },
  ],
  drillCandidates: ["d1", "d2", "d3", "d4"].map((id) => ({ id, name: `תרגיל ${id}`, why: null, goal: "ספרינט 10 מטר" })),
});
const { sheet } = buildFactSheet(week);

const words = (n: number) => Array.from({ length: n }, () => "מילה").join(" ");
const output = (overrides: Partial<WriterOutput> = {}): WriterOutput => ({
  player_text: "{שם} ישן בממוצע 7.5 שעות השבוע",
  parent_text: "{שם} הגיע מוכן לאימונים",
  drill_ids: [],
  ...overrides,
});
const codes = (holds: HoldReason[]) => holds.map((h) => h.code);

describe("reportProblems", () => {
  test("a text built from the sheet passes", () => {
    expect(reportProblems(sheet, output())).toEqual([]);
  });

  test("an invented number holds", () => {
    expect(reportProblems(sheet, output({ parent_text: "{שם} רץ 12 סיבובים" }))).toEqual([
      { code: "number", text: "מספר שלא מופיע בנתונים: 12" },
    ]);
  });

  test("a number from the sheet passes, also written with a comma", () => {
    expect(reportProblems(sheet, output({ parent_text: "ישן 7,5 שעות" }))).toEqual([]);
  });

  test("a thousands separator cannot pass an invented number off as a small one in the sheet", () => {
    // The sheet holds 7 and 8 (sleep) but no 7000 or 8000.
    expect(reportProblems(sheet, output({ parent_text: "{שם} רץ 7,000 מטר ו-8.000 צעדים" }))).toEqual([
      { code: "number", text: "מספר שלא מופיע בנתונים: 7000" },
      { code: "number", text: "מספר שלא מופיע בנתונים: 8000" },
    ]);
  });

  test("digits outside 0 to 9 hold, since the number check cannot read them", () => {
    expect(codes(reportProblems(sheet, output({ parent_text: "{שם} רץ \u0667 קילומטר" })))).toEqual(["number"]);
  });

  test("each invented number is listed once across both texts", () => {
    const holds = reportProblems(sheet, output({ player_text: "12 ו-12", parent_text: "12 ו-42" }));
    expect(holds.map((h) => h.text)).toEqual(["מספר שלא מופיע בנתונים: 12", "מספר שלא מופיע בנתונים: 42"]);
  });

  test("a drill id that was not offered holds", () => {
    expect(codes(reportProblems(sheet, output({ drill_ids: ["d1", "not-offered"] })))).toEqual(["drill"]);
  });

  test(`more than ${MAX_DRILLS} drills hold`, () => {
    expect(codes(reportProblems(sheet, output({ drill_ids: ["d1", "d2", "d3", "d4"] })))).toEqual(["drill"]);
    expect(reportProblems(sheet, output({ drill_ids: ["d1", "d2", "d3"] }))).toEqual([]);
  });

  test("a player text of 170 words holds and 160 does not", () => {
    expect(reportProblems(sheet, output({ player_text: words(170) }))).toEqual([
      { code: "length", text: "הטקסט לשחקן ארוך מדי (170 מילים)" },
    ]);
    expect(reportProblems(sheet, output({ player_text: words(160) }))).toEqual([]);
  });

  test("a parent text of 212 words holds", () => {
    expect(reportProblems(sheet, output({ parent_text: words(212) }))).toEqual([
      { code: "length", text: "הטקסט להורה ארוך מדי (212 מילים)" },
    ]);
  });

  test("an empty parent text holds", () => {
    expect(reportProblems(sheet, output({ parent_text: "  " }))).toEqual([
      { code: "length", text: "הטקסט להורה ריק" },
    ]);
  });

  test("a forbidden word holds, a training word passes", () => {
    expect(reportProblems(sheet, output({ parent_text: "התאמן ופציעה" }))).toEqual([
      { code: "forbidden_word", text: "מילה אסורה: פציעה" },
    ]);
    expect(reportProblems(sheet, output({ parent_text: "עבד עם משקלות" }))).toEqual([]);
  });

  test("missing gender holds", () => {
    const { sheet: noGender } = buildFactSheet({ ...week, profile: { ...week.profile, gender: null } });
    expect(reportProblems(noGender, output())).toEqual([{ code: "missing_gender", text: "חסר מגדר" }]);
  });
});

describe("replaceTextProblems", () => {
  test("keeps a person's reasons and replaces the text problems", () => {
    const current: HoldReason[] = [
      { code: "manual", text: "עוכב ידנית" },
      { code: "sensitive", text: "תגית כאב או פציעה מ-17/11" },
      { code: "number", text: "מספר שלא מופיע בנתונים: 12" },
      { code: "writing_failed", text: "הכתיבה נכשלה" },
    ];
    const fresh: HoldReason[] = [{ code: "length", text: "הטקסט להורה ריק" }];
    expect(replaceTextProblems(current, fresh)).toEqual([
      { code: "manual", text: "עוכב ידנית" },
      { code: "sensitive", text: "תגית כאב או פציעה מ-17/11" },
      { code: "length", text: "הטקסט להורה ריק" },
    ]);
  });
});
