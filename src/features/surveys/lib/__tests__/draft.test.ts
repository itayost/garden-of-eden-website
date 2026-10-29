import { describe, expect, test } from "vitest";
import { changeKind, emptyQuestion, moveItem, newDraft, previewSurvey } from "../draft";
import type { DraftQuestion, SurveyDraft } from "../types";

describe("moveItem", () => {
  test("returns a new array", () => {
    const a = ["x", "y", "z"];
    expect(moveItem(a, 0, 2)).toEqual(["y", "z", "x"]);
    expect(a).toEqual(["x", "y", "z"]);
    expect(moveItem(a, 0, -1)).toBe(a);
  });

  test("moves one step either way", () => {
    expect(moveItem(["x", "y", "z"], 1, 0)).toEqual(["y", "x", "z"]);
    expect(moveItem(["x", "y", "z"], 1, 2)).toEqual(["x", "z", "y"]);
  });

  test("leaves the array as it is when nothing moves or an index is out of range", () => {
    const a = ["x", "y", "z"];
    expect(moveItem(a, 1, 1)).toBe(a);
    expect(moveItem(a, 3, 0)).toBe(a);
    expect(moveItem(a, 0, 3)).toBe(a);
    expect(moveItem(a, 0.5, 1)).toBe(a);
  });
});

describe("emptyQuestion", () => {
  test("empty questions by kind", () => {
    expect(emptyQuestion("single_choice")).toEqual({
      kind: "single_choice",
      text: "",
      required: true,
      lowLabel: null,
      highLabel: null,
      options: ["", ""],
    });
    expect(emptyQuestion("multi_choice").options).toEqual(["", ""]);
    expect(emptyQuestion("rating").options).toEqual([]);
    expect(emptyQuestion("text").options).toEqual([]);
  });

  test("each call returns its own options array", () => {
    expect(emptyQuestion("single_choice").options).not.toBe(emptyQuestion("single_choice").options);
  });
});

describe("changeKind", () => {
  test("changing kind keeps options between choice kinds and drops them otherwise", () => {
    const q = { ...emptyQuestion("single_choice"), options: ["א", "ב"] };
    expect(changeKind(q, "multi_choice").options).toEqual(["א", "ב"]);
    expect(changeKind(q, "rating")).toMatchObject({ options: [], lowLabel: null });
    expect(changeKind(q, "text").options).toEqual([]);
  });

  test("the end labels are cleared unless the new kind is a rating", () => {
    const rating: DraftQuestion = { ...emptyQuestion("rating"), lowLabel: "בכלל לא", highLabel: "מאוד" };
    expect(changeKind(rating, "text")).toMatchObject({ lowLabel: null, highLabel: null });
    expect(changeKind(rating, "single_choice")).toMatchObject({ lowLabel: null, highLabel: null });
    expect(changeKind(rating, "rating")).toMatchObject({ lowLabel: "בכלל לא", highLabel: "מאוד" });
  });

  test("a choice kind after a rating or text starts with two blank options", () => {
    expect(changeKind(emptyQuestion("rating"), "single_choice").options).toEqual(["", ""]);
    expect(changeKind(emptyQuestion("text"), "multi_choice").options).toEqual(["", ""]);
  });

  test("the text and the required flag survive a change of kind", () => {
    const q: DraftQuestion = { ...emptyQuestion("text"), text: "מה לשנות?", required: false };
    expect(changeKind(q, "rating")).toMatchObject({ kind: "rating", text: "מה לשנות?", required: false });
  });

  test("does not change the question it was given", () => {
    const q = { ...emptyQuestion("single_choice"), options: ["א", "ב"] };
    const next = changeKind(q, "multi_choice");
    expect(next).not.toBe(q);
    expect(next.options).not.toBe(q.options);
    expect(q).toEqual({ ...emptyQuestion("single_choice"), options: ["א", "ב"] });
  });
});

describe("newDraft", () => {
  test("a new draft opens today with no close date", () =>
    expect(newDraft("2026-10-29")).toMatchObject({
      title: "",
      opensOn: "2026-10-29",
      closesOn: null,
      questions: [],
    }));

  test("names no branch, no birth year and no intro", () => {
    expect(newDraft("2026-10-29")).toMatchObject({ intro: null, branchIds: [], birthYears: [] });
  });
});

describe("previewSurvey", () => {
  const draft: SurveyDraft = {
    ...newDraft("2026-10-29"),
    title: "  איך היה לך באקדמיה?  ",
    intro: "חמש שאלות קצרות",
    closesOn: "2026-11-05",
    questions: [
      { ...emptyQuestion("rating"), text: " כמה נהנית? ", lowLabel: "בכלל לא", highLabel: "מאוד" },
      { ...emptyQuestion("single_choice"), text: "כמה פעמים?", options: ["פעם", " פעמיים "] },
      { ...emptyQuestion("text"), text: "מה לשנות?", required: false },
    ],
  };

  test("gives every Question and option a temporary id", () => {
    const survey = previewSurvey(draft);
    expect(survey.questions.map((question) => question.id)).toEqual([
      "preview-q0",
      "preview-q1",
      "preview-q2",
    ]);
    expect(survey.questions[1].options).toEqual([
      { id: "preview-q1-o0", label: "פעם" },
      { id: "preview-q1-o1", label: "פעמיים" },
    ]);
  });

  test("carries the title, intro, close date, kinds, labels and required flags", () => {
    const survey = previewSurvey(draft);
    expect(survey).toMatchObject({
      title: "איך היה לך באקדמיה?",
      intro: "חמש שאלות קצרות",
      closesOn: "2026-11-05",
    });
    expect(survey.questions[0]).toMatchObject({
      kind: "rating",
      text: "כמה נהנית?",
      required: true,
      lowLabel: "בכלל לא",
      highLabel: "מאוד",
      options: [],
    });
    expect(survey.questions[2]).toMatchObject({ kind: "text", required: false });
  });

  test("a blank intro reads as no intro", () => {
    expect(previewSurvey({ ...draft, intro: "   " }).intro).toBeNull();
    expect(previewSurvey({ ...draft, intro: null }).intro).toBeNull();
  });

  test("a rating or text Question never carries options", () => {
    const withStray: SurveyDraft = {
      ...draft,
      questions: [{ ...emptyQuestion("rating"), text: "כמה?", options: ["x"] }],
    };
    expect(previewSurvey(withStray).questions[0].options).toEqual([]);
  });
});
