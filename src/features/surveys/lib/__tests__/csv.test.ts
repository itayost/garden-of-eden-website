import { expect, test } from "vitest";
import { formatSentAt, surveyCsvRows } from "../csv";
import type { CellAnswer, GridRow } from "../report";
import type { SurveyQuestion } from "../types";
import { KA, HA, build, person, questions } from "./fixtures";

test("sent time in Israel time", () => {
  expect(formatSentAt("2026-10-28T15:42:00.000Z")).toBe("28.10.2026 17:42");
});

test("summer time is three hours ahead", () => {
  expect(formatSentAt("2026-07-01T12:00:00Z")).toBe("01.07.2026 15:00");
});

test("midnight reads 00, not 24, and the date moves on", () => {
  expect(formatSentAt("2026-10-28T22:30:00Z")).toBe("29.10.2026 00:30");
});

test("one row per response, Hebrew headers, multi joined", () => {
  const rows = surveyCsvRows(questions, build().allRows);
  expect(Object.keys(rows[0])).toEqual([
    "שם",
    "סניף",
    "שנתון",
    "נשלח",
    "1. כמה נהנית?",
    "2. כמה פעמים?",
    "3. מה עוזר?",
    "4. מה לשנות?",
  ]);
  expect(rows[0]).toMatchObject({
    "שם": "יונתן לוי",
    "סניף": "קריית אתא",
    "שנתון": "2014",
    "1. כמה נהנית?": "5",
    "3. מה עוזר?": "תרגילי כדור, משחקונים",
    "4. מה לשנות?": "יותר משחקים",
  });
  expect(rows[1]["4. מה לשנות?"]).toBe("");
});

test("rows follow the report order and carry the sent time", () => {
  const rows = surveyCsvRows(questions, build().allRows);
  expect(rows.map((row) => row["שם"])).toEqual(["יונתן לוי", "אורי בן דוד", "דניאל אוחיון"]);
  expect(rows[0]["נשלח"]).toBe("28.10.2026 17:42");
});

test("two branches are joined and a missing birth year is empty", () => {
  const twoBranches = build({
    responses: [
      {
        ...person("p5", "תמר חדד", [KA, HA], null),
        submittedAt: "2026-10-28T08:00:00Z",
        answers: [],
      },
    ],
  });
  const [row] = surveyCsvRows(questions, twoBranches.allRows);
  expect(row["סניף"]).toBe("קריית אתא, חיפה");
  expect(row["שנתון"]).toBe("");
});

test("no responses gives no rows", () => {
  expect(surveyCsvRows(questions, [])).toEqual([]);
});

// Formula injection: Trainees type free text and staff open the export in Excel.

const gridRow = (over: Partial<GridRow>): GridRow => ({
  profileId: "p1",
  fullName: "דנה כהן",
  branchNames: ["חיפה"],
  birthYear: 2014,
  submittedAt: "2026-10-28T15:42:00Z",
  answers: {},
  ...over,
});

const freeText: SurveyQuestion = { id: "t", kind: "text", text: "מה לשנות?", required: false, lowLabel: null, highLabel: null, options: [] };
const choice: SurveyQuestion = { id: "c", kind: "multi_choice", text: "מה עוזר?", required: false, lowLabel: null, highLabel: null, options: [{ id: "a", label: "=cmd" }, { id: "b", label: "אחר" }] };
const textCell = (text: string): CellAnswer => ({ optionLabels: [], rating: null, text });

test.each(["=1+1", "@x", "-5 שאלות", "+972", "=1+1\nline2", "\tx", "\rx"])(
  "free text %j that starts like a formula gets a leading quote",
  (text) => {
    const [row] = surveyCsvRows([freeText], [gridRow({ answers: { t: textCell(text) } })]);
    expect(row["1. מה לשנות?"]).toBe(`'${text}`);
  },
);

test("free text that does not start like a formula is left alone", () => {
  const [row] = surveyCsvRows([freeText], [gridRow({ answers: { t: textCell("מה ש=1+1 ו-2") } })]);
  expect(row["1. מה לשנות?"]).toBe("מה ש=1+1 ו-2");
});

test("a name, a branch name and a choice label get the same guard", () => {
  const [row] = surveyCsvRows(
    [choice],
    [
      gridRow({
        fullName: "=HYPERLINK(1)",
        branchNames: ["@חיפה", "קריית אתא"],
        answers: { c: { optionLabels: ["=cmd", "אחר"], rating: null, text: null } },
      }),
    ],
  );
  expect(row["שם"]).toBe("'=HYPERLINK(1)");
  expect(row["סניף"]).toBe("'@חיפה, קריית אתא");
  expect(row["1. מה עוזר?"]).toBe("'=cmd, אחר");
});

test("the rating, the birth year and the sent time are not prefixed", () => {
  const rating: SurveyQuestion = { id: "r", kind: "rating", text: "כמה?", required: true, lowLabel: null, highLabel: null, options: [] };
  const [row] = surveyCsvRows(
    [rating],
    [gridRow({ answers: { r: { optionLabels: [], rating: 4, text: null } } })],
  );
  expect(row["1. כמה?"]).toBe("4");
  expect(row["שנתון"]).toBe("2014");
  expect(row["נשלח"]).toBe("28.10.2026 17:42");
});
