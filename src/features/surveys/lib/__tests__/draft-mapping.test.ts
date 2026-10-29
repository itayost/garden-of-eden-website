import { describe, expect, test } from "vitest";
import { toDraft, toQuestionsPayload } from "../draft-mapping";
import type { DraftQuestion, SurveyQuestion, SurveyRecord } from "../types";

describe("toQuestionsPayload", () => {
  test("maps each Question to the keys of save_survey_draft", () => {
    const questions: DraftQuestion[] = [
      { kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: ["פעם", "פעמיים"] },
      { kind: "rating", text: "כמה נהנית?", required: false, lowLabel: "בכלל לא", highLabel: "מאוד", options: [] },
    ];
    expect(toQuestionsPayload(questions)).toEqual([
      { kind: "single_choice", prompt: "כמה פעמים?", required: true, low_label: null, high_label: null, options: ["פעם", "פעמיים"] },
      { kind: "rating", prompt: "כמה נהנית?", required: false, low_label: "בכלל לא", high_label: "מאוד", options: [] },
    ]);
  });

  test("trims the text and every option", () => {
    const [payload] = toQuestionsPayload([
      { kind: "multi_choice", text: "  מה עוזר?  ", required: true, lowLabel: null, highLabel: null, options: [" כדור ", "משחקונים  "] },
    ]);
    expect(payload.prompt).toBe("מה עוזר?");
    expect(payload.options).toEqual(["כדור", "משחקונים"]);
  });

  test("rating and text Questions send no options, even if the draft carried some", () => {
    const payload = toQuestionsPayload([
      { kind: "rating", text: "כמה נהנית?", required: true, lowLabel: null, highLabel: null, options: ["x"] },
      { kind: "text", text: "מה לשנות?", required: false, lowLabel: null, highLabel: null, options: ["y"] },
    ]);
    expect(payload.map((q) => q.options)).toEqual([[], []]);
  });

  test("keeps the order and does not change its input", () => {
    const questions: DraftQuestion[] = [
      { kind: "text", text: " ב ", required: true, lowLabel: null, highLabel: null, options: [] },
      { kind: "text", text: " א ", required: true, lowLabel: null, highLabel: null, options: [] },
    ];
    expect(toQuestionsPayload(questions).map((q) => q.prompt)).toEqual(["ב", "א"]);
    expect(questions[0].text).toBe(" ב ");
  });
});

describe("toDraft", () => {
  const record: SurveyRecord = {
    id: "s1",
    title: "סקר סוף עונה",
    intro: "תודה",
    opensOn: "2026-11-01",
    closesOn: null,
    birthYears: [2014, 2015],
    branchIds: ["b1", "b2"],
    createdBy: "u1",
    createdAt: "2026-10-29T10:00:00Z",
    publishedAt: null,
    closedAt: null,
  };
  const questions: SurveyQuestion[] = [
    { id: "q1", kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: [{ id: "o1", label: "פעם" }, { id: "o2", label: "פעמיים" }] },
    { id: "q2", kind: "rating", text: "כמה נהנית?", required: false, lowLabel: "בכלל לא", highLabel: "מאוד", options: [] },
  ];

  test("carries the survey's own fields", () => {
    expect(toDraft(record, questions)).toMatchObject({
      title: "סקר סוף עונה",
      intro: "תודה",
      opensOn: "2026-11-01",
      closesOn: null,
      birthYears: [2014, 2015],
      branchIds: ["b1", "b2"],
    });
  });

  test("turns stored Questions into draft Questions with option labels", () => {
    expect(toDraft(record, questions).questions).toEqual([
      { kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: ["פעם", "פעמיים"] },
      { kind: "rating", text: "כמה נהנית?", required: false, lowLabel: "בכלל לא", highLabel: "מאוד", options: [] },
    ]);
  });
});
