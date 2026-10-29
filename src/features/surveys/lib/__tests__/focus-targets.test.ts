import { describe, expect, test } from "vitest";
import { ADD_OPTION_FOCUS, ADD_QUESTION_FOCUS, focusAfterMove, focusAfterRemove, focusId } from "../focus-targets";

describe("focusId", () => {
  test("names a control by what kind of row it is in, the row's place and its part", () => {
    expect(focusId("question", 0, "down")).toBe("question-0:down");
    expect(focusId("option", 2, "remove")).toBe("option-2:remove");
  });

  test("a Question's control and an option's at the same place never share an id", () => {
    expect(focusId("question", 1, "remove")).not.toBe(focusId("option", 1, "remove"));
  });

  test("carries nothing random, so the server and the browser render the same ids", () => {
    expect(focusId("question", 3, "summary")).toBe(focusId("question", 3, "summary"));
    expect(focusId("question", 3, "summary")).toMatch(/^question-3:summary$/);
  });
});

describe("focusAfterMove", () => {
  test("the arrow that was pressed is kept while the row can still go that way", () => {
    expect(focusAfterMove("question", 1, 1, 3)).toEqual(["question-1:down"]);
    expect(focusAfterMove("question", 1, -1, 3)).toEqual(["question-1:up"]);
  });

  test("a row that reached the end swaps to the other arrow, which is still live", () => {
    expect(focusAfterMove("option", 2, 1, 3)).toEqual(["option-2:up"]);
    expect(focusAfterMove("option", 0, -1, 3)).toEqual(["option-0:down"]);
  });

  test("with two rows every move reaches an end", () => {
    expect(focusAfterMove("question", 1, 1, 2)).toEqual(["question-1:up"]);
    expect(focusAfterMove("question", 0, -1, 2)).toEqual(["question-0:down"]);
  });
});

describe("focusAfterRemove", () => {
  test("goes to the row that takes the deleted row's place, then the add control", () => {
    expect(focusAfterRemove("option", 0, 3, ["remove"], ADD_OPTION_FOCUS)).toEqual(["option-0:remove", ADD_OPTION_FOCUS]);
    expect(focusAfterRemove("option", 1, 3, ["remove"], ADD_OPTION_FOCUS)).toEqual(["option-1:remove", ADD_OPTION_FOCUS]);
  });

  test("offers each part of that row in order of preference", () => {
    expect(focusAfterRemove("question", 0, 3, ["remove", "summary"], ADD_QUESTION_FOCUS)).toEqual([
      "question-0:remove",
      "question-0:summary",
      ADD_QUESTION_FOCUS,
    ]);
  });

  test("deleting the last row goes straight to the add control", () => {
    expect(focusAfterRemove("question", 2, 3, ["remove"], ADD_QUESTION_FOCUS)).toEqual([ADD_QUESTION_FOCUS]);
    expect(focusAfterRemove("question", 0, 1, ["remove"], ADD_QUESTION_FOCUS)).toEqual([ADD_QUESTION_FOCUS]);
  });
});
