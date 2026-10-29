import { describe, expect, test } from "vitest";
import { emptyQuestion, newDraft } from "../draft";
import {
  blankOption,
  newEditorQuestion,
  toEditorForm,
  toEditorQuestion,
  toSurveyDraft,
  withKind,
} from "../editor-model";
import type { SurveyDraft } from "../types";

/** Keys k1, k2, ... so a test can name them. */
function counter(): () => string {
  let n = 0;
  return () => `k${++n}`;
}

const draft: SurveyDraft = {
  ...newDraft("2026-10-29"),
  title: "איך היה לך באקדמיה?",
  branchIds: ["b-ka"],
  birthYears: [2014],
  questions: [
    { ...emptyQuestion("single_choice"), text: "כמה פעמים?", options: ["פעם", "פעמיים"] },
    { ...emptyQuestion("rating"), text: "כמה נהנית?", lowLabel: "בכלל לא", highLabel: "מאוד" },
  ],
};

describe("toEditorForm and toSurveyDraft", () => {
  test("a draft survives the round trip", () => {
    expect(toSurveyDraft(toEditorForm(draft))).toEqual(draft);
  });

  test("every Question and every option gets its own key", () => {
    const form = toEditorForm(draft, counter());
    expect(form.questions.map((question) => question.key)).toEqual(["k1", "k4"]);
    expect(form.questions[0].options).toEqual([
      { key: "k2", label: "פעם" },
      { key: "k3", label: "פעמיים" },
    ]);
  });

  test("the keys do not reach the draft that is saved", () => {
    const saved = toSurveyDraft(toEditorForm(draft));
    expect(Object.keys(saved.questions[0]).sort()).toEqual(
      ["highLabel", "kind", "lowLabel", "options", "required", "text"].sort(),
    );
  });

  test("with the default key maker, keys are unique", () => {
    const keys = toEditorForm(draft).questions.flatMap((question) => [
      question.key,
      ...question.options.map((option) => option.key),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("does not change the draft it was given", () => {
    const before = JSON.stringify(draft);
    toEditorForm(draft);
    expect(JSON.stringify(draft)).toBe(before);
  });
});

describe("newEditorQuestion", () => {
  test("is the empty Question of the kind, with keys", () => {
    const question = newEditorQuestion("single_choice", counter());
    expect(question).toMatchObject({ key: "k1", kind: "single_choice", text: "", required: true });
    expect(question.options).toEqual([
      { key: "k2", label: "" },
      { key: "k3", label: "" },
    ]);
  });

  test("a rating has no options", () => {
    expect(newEditorQuestion("rating").options).toEqual([]);
  });
});

describe("blankOption", () => {
  test("is an empty option with a key", () => {
    expect(blankOption(counter())).toEqual({ key: "k1", label: "" });
  });
});

describe("withKind", () => {
  const single = toEditorQuestion(
    { ...emptyQuestion("single_choice"), text: "כמה פעמים?", options: ["פעם", "פעמיים"] },
    counter(),
  );

  test("keeps the Question's key, and the options and their keys between choice kinds", () => {
    const next = withKind(single, "multi_choice");
    expect(next).toMatchObject({ key: "k1", kind: "multi_choice", text: "כמה פעמים?" });
    expect(next.options).toEqual(single.options);
  });

  test("a rating has no options and keeps the Question's key", () => {
    expect(withKind(single, "rating")).toMatchObject({ key: "k1", kind: "rating", options: [] });
  });

  test("a choice kind after a rating starts with two blank options of their own keys", () => {
    const rating = withKind(single, "rating");
    const back = withKind(rating, "single_choice", counter());
    expect(back.key).toBe("k1");
    expect(back.options).toEqual([
      { key: "k1", label: "" },
      { key: "k2", label: "" },
    ]);
  });

  test("the end labels belong to a rating only", () => {
    const rating = { ...withKind(single, "rating"), lowLabel: "בכלל לא", highLabel: "מאוד" };
    expect(withKind(rating, "text")).toMatchObject({ lowLabel: null, highLabel: null });
    expect(withKind(rating, "rating")).toMatchObject({ lowLabel: "בכלל לא", highLabel: "מאוד" });
  });
});
