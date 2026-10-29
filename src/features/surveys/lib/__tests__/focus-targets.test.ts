import { describe, expect, test } from "vitest";
import { ADD_OPTION_FOCUS, ADD_QUESTION_FOCUS, focusAfterMove, focusAfterRemove, focusId } from "../focus-targets";

describe("focusId", () => {
  test("names a control by its row's key and its part", () => {
    expect(focusId("k1", "down")).toBe("k1:down");
    expect(focusId("k1", "remove")).toBe("k1:remove");
  });
});

describe("focusAfterMove", () => {
  test("the arrow that was pressed is kept while the row can still go that way", () => {
    expect(focusAfterMove("k1", 1, 1, 3)).toEqual(["k1:down"]);
    expect(focusAfterMove("k1", -1, 1, 3)).toEqual(["k1:up"]);
  });

  test("a row that reached the end swaps to the other arrow, which is still live", () => {
    expect(focusAfterMove("k1", 1, 2, 3)).toEqual(["k1:up"]);
    expect(focusAfterMove("k1", -1, 0, 3)).toEqual(["k1:down"]);
  });

  test("with two rows every move reaches an end", () => {
    expect(focusAfterMove("k1", 1, 1, 2)).toEqual(["k1:up"]);
    expect(focusAfterMove("k1", -1, 0, 2)).toEqual(["k1:down"]);
  });
});

describe("focusAfterRemove", () => {
  const keys = ["a", "b", "c"];

  test("goes to the row that takes the deleted row's place, then the add control", () => {
    expect(focusAfterRemove(keys, 0, ["remove"], ADD_OPTION_FOCUS)).toEqual(["b:remove", ADD_OPTION_FOCUS]);
    expect(focusAfterRemove(keys, 1, ["remove"], ADD_OPTION_FOCUS)).toEqual(["c:remove", ADD_OPTION_FOCUS]);
  });

  test("offers each part of the next row in order of preference", () => {
    expect(focusAfterRemove(keys, 0, ["remove", "summary"], ADD_QUESTION_FOCUS)).toEqual([
      "b:remove",
      "b:summary",
      ADD_QUESTION_FOCUS,
    ]);
  });

  test("deleting the last row goes straight to the add control", () => {
    expect(focusAfterRemove(keys, 2, ["remove"], ADD_QUESTION_FOCUS)).toEqual([ADD_QUESTION_FOCUS]);
  });

  test("leaves the keys it was given alone", () => {
    const given = [...keys];
    focusAfterRemove(given, 0, ["remove"], ADD_OPTION_FOCUS);
    expect(given).toEqual(keys);
  });
});
