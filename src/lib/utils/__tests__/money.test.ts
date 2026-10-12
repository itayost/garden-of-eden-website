import { describe, expect, test } from "vitest";
import { formatIls } from "../money";

describe("formatIls", () => {
  test("groups thousands with a shekel sign", () => {
    expect(formatIls(1200)).toBe("₪1,200");
  });
  test("keeps agorot when there are any", () => {
    expect(formatIls(12.5)).toBe("₪12.5");
  });
  test("zero and negative zero read ₪0", () => {
    expect(formatIls(0)).toBe("₪0");
    expect(formatIls(-0)).toBe("₪0");
  });
  test("a negative amount leads with a minus sign", () => {
    expect(formatIls(-310)).toBe("−₪310");
  });
});
