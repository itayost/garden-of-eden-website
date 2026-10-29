import { describe, expect, test } from "vitest";
import { answersProblem, submitErrorMessage, toAnswerRows } from "../answers";
import type { AnswerInput, SurveyQuestion } from "../types";

const Q: SurveyQuestion[] = [
  { id: "q1", kind: "rating", text: "כמה נהנית?", required: true, lowLabel: null, highLabel: null, options: [] },
  { id: "q2", kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: [{ id: "o1", label: "פעם" }, { id: "o2", label: "פעמיים" }] },
  { id: "q3", kind: "multi_choice", text: "מה עוזר?", required: true, lowLabel: null, highLabel: null, options: [{ id: "m1", label: "כדור" }, { id: "m2", label: "משחקונים" }] },
  { id: "q4", kind: "text", text: "מה לשנות?", required: false, lowLabel: null, highLabel: null, options: [] },
];
const ok: AnswerInput[] = [{ questionId: "q1", rating: 5 }, { questionId: "q2", optionIds: ["o2"] }, { questionId: "q3", optionIds: ["m1", "m2"] }, { questionId: "q4", text: " יותר משחקים " }];
const without = (id: string) => ok.filter((a) => a.questionId !== id);

describe("answersProblem", () => {
  test("a full answer set passes", () => expect(answersProblem(Q, ok)).toBeNull());
  test("a missing required answer", () => expect(answersProblem(Q, without("q2"))).toBe("נא לענות על שאלה 2"));
  test("an optional question may be skipped", () => expect(answersProblem(Q, without("q4"))).toBeNull());
  test("unknown question means the survey changed", () => expect(answersProblem(Q, [...ok, { questionId: "q9", rating: 3 }])).toBe("הסקר עודכן בינתיים. סגרו אותו ופתחו שוב."));
  test("the same question twice", () => expect(answersProblem(Q, [...ok, { questionId: "q1", rating: 4 }])).toBe("שאלה 1: נענתה פעמיים"));
  test("single choice needs exactly one option of its own", () => {
    expect(answersProblem(Q, [...without("q2"), { questionId: "q2", optionIds: ["o1", "o2"] }])).toBe("שאלה 2: בחירה לא תקינה");
    expect(answersProblem(Q, [...without("q2"), { questionId: "q2", optionIds: ["m1"] }])).toBe("שאלה 2: בחירה לא תקינה");
  });
  test("multiple choice needs distinct options of its own", () => expect(answersProblem(Q, [...without("q3"), { questionId: "q3", optionIds: ["m1", "m1"] }])).toBe("שאלה 3: בחירה לא תקינה"));
  test("rating is a whole number 1 to 5", () => {
    expect(answersProblem(Q, [...without("q1"), { questionId: "q1", rating: 6 }])).toBe("שאלה 1: דירוג חייב להיות בין 1 ל-5");
    expect(answersProblem(Q, [...without("q1"), { questionId: "q1", rating: 2.5 }])).toBe("שאלה 1: דירוג חייב להיות בין 1 ל-5");
  });
  test("text over 1000 characters", () => expect(answersProblem(Q, [...without("q4"), { questionId: "q4", text: "א".repeat(1001) }])).toBe("שאלה 4: התשובה ארוכה מ-1000 תווים"));
  test("spaces-only required text is refused", () => {
    const req = Q.map((q) => (q.id === "q4" ? { ...q, required: true } : q));
    expect(answersProblem(req, [...without("q4"), { questionId: "q4", text: "  " }])).toBe("נא לענות על שאלה 4");
  });
});

describe("toAnswerRows", () => {
  test("spaces-only optional text is dropped", () => {
    const rows = toAnswerRows(Q, [...without("q4"), { questionId: "q4", text: "   " }]);
    expect(rows.some((r) => r.questionId === "q4")).toBe(false);
  });
  test("rows: one per chosen option, trimmed text", () => expect(toAnswerRows(Q, ok)).toEqual([
    { questionId: "q1", optionId: null, rating: 5, text: null },
    { questionId: "q2", optionId: "o2", rating: null, text: null },
    { questionId: "q3", optionId: "m1", rating: null, text: null },
    { questionId: "q3", optionId: "m2", rating: null, text: null },
    { questionId: "q4", optionId: null, rating: null, text: "יותר משחקים" },
  ]));
});

describe("submitErrorMessage", () => {
  test("database errors map to Hebrew", () => {
    expect(submitErrorMessage("already_answered")).toBe("כבר ענית על הסקר הזה");
    expect(submitErrorMessage("survey_not_open")).toBe("הסקר כבר נסגר");
    expect(submitErrorMessage("survey_changed")).toBe("הסקר עודכן בינתיים. סגרו אותו ופתחו שוב.");
    expect(submitErrorMessage("connection reset")).toBe("השליחה נכשלה. נסו שוב.");
  });
  test("a raised text wrapped in a longer message still maps", () => {
    expect(submitErrorMessage("ERROR: already_answered (SQLSTATE P0001)")).toBe("כבר ענית על הסקר הזה");
  });
});
