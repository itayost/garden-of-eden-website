import { describe, expect, it } from "vitest";
import { safeEqualUtf8 } from "../safe-equal";

describe("safeEqualUtf8", () => {
  it("is true only for the same string", () => {
    expect(safeEqualUtf8("abc123", "abc123")).toBe(true);
    expect(safeEqualUtf8("abc123", "abc124")).toBe(false);
  });

  it("refuses, rather than throws, a multibyte string of the same character count", () => {
    expect(safeEqualUtf8("abcא", "abcd")).toBe(false);
  });
});
