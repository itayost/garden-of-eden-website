import { describe, expect, test } from "vitest";
import { FORBIDDEN_PHRASES, forbiddenIn } from "../forbidden-words";

describe("forbiddenIn", () => {
  test.each([
    ["ופציעה", ["פציעה"]],
    ["לפציעות", ["פציעה"]],
    ["אחרי הפציעה שלו", ["פציעה"]],
    ["פציעתו", ["פציעה"]],
    ["כאבים ברגל", ["כאב"]],
    ["שומנים", ["שומן"]],
    ["ספירת קלוריות", ["קלוריות"]],
    ["ועליה במשקל", ["עלייה במשקל"]],
    ["ירידה  במשקלו", ["ירידה במשקל"]],
    ["פְּצִיעָה", ["פציעה"]],
  ])("%s is forbidden", (text, expected) => expect(forbiddenIn(text)).toEqual(expected));

  test.each([
    ["עבד עם משקלות"],
    ["ירופא"],
    ["הקשר מתרופף"],
    ["הדיאטנית השאירה המלצה"],
    ["{שם} השקיע מאוד השבוע"],
  ])("%s passes", (text) => expect(forbiddenIn(text)).toEqual([]));

  test("a prefix letter is a word start: מכאבו is held for a person", () => {
    expect(forbiddenIn("התאושש מכאבו")).toEqual(["כאב"]);
  });

  test("each phrase is listed once, in list order", () => {
    expect(forbiddenIn("פציעה, כאב, ועוד פציעה")).toEqual(["פציעה", "כאב"]);
  });

  test("the list leaves out משקל alone, a training word", () => {
    expect(FORBIDDEN_PHRASES).not.toContain("משקל");
  });
});
