import { describe, expect, test } from "vitest";
import { SIGNIFICANT_EDIT, combinedEditRatio, editRatio } from "../edit-ratio";

describe("editRatio", () => {
  test("the same text is 0", () => expect(editRatio("abc", "abc")).toBe(0));
  test("two empty texts are 0", () => expect(editRatio("", "")).toBe(0));
  test("a text changed throughout is 1", () => expect(editRatio("abc", "xyz")).toBe(1));
  test("a text written from nothing is 1", () => expect(editRatio("", "abc")).toBe(1));

  test("one changed character in 100 is 0.01", () => {
    const original = "א".repeat(100);
    const edited = `${"א".repeat(99)}ב`;
    expect(editRatio(original, edited)).toBe(0.01);
  });

  test("rounds to three decimals", () => expect(editRatio("kitten", "sitting")).toBe(0.429));
});

describe("combinedEditRatio", () => {
  test("measures both texts as one", () => {
    const original = { player_text: "abc", parent_text: "def", drill_ids: [] };
    expect(combinedEditRatio(original, "abc", "def")).toBe(0);
    expect(combinedEditRatio(original, "abc", "dez")).toBe(0.143);
  });

  test("an edit above 15% is significant", () => {
    expect(SIGNIFICANT_EDIT).toBe(0.15);
  });
});
