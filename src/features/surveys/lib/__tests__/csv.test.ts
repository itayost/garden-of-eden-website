import { expect, test } from "vitest";
import { formatSentAt, surveyCsvRows } from "../csv";
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
