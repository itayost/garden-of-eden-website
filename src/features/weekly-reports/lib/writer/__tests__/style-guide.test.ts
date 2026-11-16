import { describe, expect, it } from "vitest";
import { PROMPT_VERSION, STYLE_GUIDE, STYLE_GUIDE_HAS_PLACEHOLDER_SAMPLES } from "../style-guide";

describe("style guide", () => {
  it("has a dated version", () => {
    expect(PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("tells the model to write the name placeholder and the two lengths", () => {
    expect(STYLE_GUIDE).toContain("{שם}");
    expect(STYLE_GUIDE).toContain("110");
    expect(STYLE_GUIDE).toContain("140");
    expect(STYLE_GUIDE).toContain("player_text");
    expect(STYLE_GUIDE).toContain("parent_text");
    expect(STYLE_GUIDE).toContain("drill_ids");
  });

  it("holds no em dash, en dash or emoji", () => {
    expect(STYLE_GUIDE).not.toMatch(/[–—]/);
    expect(STYLE_GUIDE).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("carries the sample reports, so the preview script may run", () => {
    expect(STYLE_GUIDE_HAS_PLACEHOLDER_SAMPLES).toBe(false);
    expect(STYLE_GUIDE).toContain("### דוגמה 1");
  });
});
