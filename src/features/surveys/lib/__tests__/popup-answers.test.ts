import { describe, expect, test } from "vitest";
import {
  answersToSend,
  canContinue,
  chooseOne,
  rate,
  toggleOption,
  writeText,
  type AnswerMap,
} from "../popup-answers";
import type { SurveyQuestion } from "../types";

const rating: SurveyQuestion = { id: "q1", kind: "rating", text: "כמה נהנית?", required: true, lowLabel: null, highLabel: null, options: [] };
const single: SurveyQuestion = { id: "q2", kind: "single_choice", text: "כמה פעמים?", required: true, lowLabel: null, highLabel: null, options: [{ id: "o1", label: "פעם" }, { id: "o2", label: "פעמיים" }] };
const multi: SurveyQuestion = { id: "q3", kind: "multi_choice", text: "מה עוזר?", required: true, lowLabel: null, highLabel: null, options: [{ id: "m1", label: "כדור" }, { id: "m2", label: "משחקונים" }, { id: "m3", label: "כוח" }] };
const text: SurveyQuestion = { id: "q4", kind: "text", text: "מה לשנות?", required: false, lowLabel: null, highLabel: null, options: [] };
const all = [rating, single, multi, text];

const empty: AnswerMap = {};

describe("answer updates", () => {
  test("chooseOne keeps exactly one option and replaces the earlier one", () => {
    const first = chooseOne(empty, "q2", "o1");
    const second = chooseOne(first, "q2", "o2");
    expect(second.q2).toEqual({ questionId: "q2", optionIds: ["o2"] });
  });

  test("toggleOption adds an option and removes it again", () => {
    const one = toggleOption(empty, "q3", "m2");
    const two = toggleOption(one, "q3", "m1");
    expect(two.q3?.optionIds).toEqual(["m2", "m1"]);
    expect(toggleOption(two, "q3", "m2").q3?.optionIds).toEqual(["m1"]);
  });

  test("rate and writeText store the value under the question", () => {
    expect(rate(empty, "q1", 4).q1).toEqual({ questionId: "q1", rating: 4 });
    expect(writeText(empty, "q4", "יותר משחקים").q4).toEqual({ questionId: "q4", text: "יותר משחקים" });
  });

  test("an update returns a new map and leaves the old one and other answers alone", () => {
    const before = rate(empty, "q1", 3);
    const after = chooseOne(before, "q2", "o1");
    expect(after).not.toBe(before);
    expect(before).toEqual({ q1: { questionId: "q1", rating: 3 } });
    expect(after.q1).toBe(before.q1);
  });
});

describe("canContinue", () => {
  test("a required question needs a value of its kind", () => {
    expect(canContinue(rating, undefined)).toBe(false);
    expect(canContinue(rating, { questionId: "q1", rating: 1 })).toBe(true);
    expect(canContinue(single, { questionId: "q2", optionIds: [] })).toBe(false);
    expect(canContinue(single, { questionId: "q2", optionIds: ["o1"] })).toBe(true);
    expect(canContinue(multi, toggleOption(toggleOption(empty, "q3", "m1"), "q3", "m1").q3)).toBe(false);
  });

  test("a required text question is not answered by spaces", () => {
    const required: SurveyQuestion = { ...text, required: true };
    expect(canContinue(required, { questionId: "q4", text: "   " })).toBe(false);
    expect(canContinue(required, { questionId: "q4", text: " כן " })).toBe(true);
  });

  test("an optional question can always be passed", () => {
    expect(canContinue(text, undefined)).toBe(true);
    expect(canContinue(text, { questionId: "q4", text: "" })).toBe(true);
  });
});

describe("answersToSend", () => {
  test("one answer per answered question, in the order of the questions", () => {
    const map: AnswerMap = {
      ...writeText(empty, "q4", "  יותר משחקים  "),
      ...rate(empty, "q1", 5),
      ...chooseOne(empty, "q2", "o2"),
      ...toggleOption(empty, "q3", "m3"),
    };
    expect(answersToSend(all, map)).toEqual([
      { questionId: "q1", rating: 5 },
      { questionId: "q2", optionIds: ["o2"] },
      { questionId: "q3", optionIds: ["m3"] },
      { questionId: "q4", text: "יותר משחקים" },
    ]);
  });

  test("an unanswered optional question and blank text are left out", () => {
    const map: AnswerMap = { ...rate(empty, "q1", 2), ...writeText(empty, "q4", "   ") };
    expect(answersToSend([rating, text], map)).toEqual([{ questionId: "q1", rating: 2 }]);
  });

  test("chosen options are listed in the question's own order, whatever the click order", () => {
    const clicked = toggleOption(toggleOption(empty, "q3", "m3"), "q3", "m1");
    expect(answersToSend([multi], clicked)).toEqual([{ questionId: "q3", optionIds: ["m1", "m3"] }]);
  });

  test("an option that is no longer on the question is dropped", () => {
    const stale = toggleOption(toggleOption(empty, "q3", "gone"), "q3", "m2");
    expect(answersToSend([multi], stale)).toEqual([{ questionId: "q3", optionIds: ["m2"] }]);
  });

  test("an answer to a question that is not in the list is not sent", () => {
    expect(answersToSend([rating], { ...rate(empty, "q1", 3), ...rate(empty, "q9", 1) })).toEqual([
      { questionId: "q1", rating: 3 },
    ]);
  });
});
