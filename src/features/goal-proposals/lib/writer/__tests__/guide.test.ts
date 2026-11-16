import { describe, expect, it } from "vitest";
import { GOAL_GUIDE, GOAL_PROMPT_VERSION } from "../guide";

describe("goal guide", () => {
  it("has a dated version", () => {
    expect(GOAL_PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("names the three fields of a pick", () => {
    expect(GOAL_GUIDE).toContain("metric_key");
    expect(GOAL_GUIDE).toContain("reason");
    expect(GOAL_GUIDE).toContain("drill_ids");
  });

  it("names the candidate facts the choice leans on", () => {
    expect(GOAL_GUIDE).toContain("positionFit");
    expect(GOAL_GUIDE).toContain("מתאים לעמדה");
    expect(GOAL_GUIDE).toContain("betterThanPercent");
    expect(GOAL_GUIDE).toContain("25");
  });

  it("holds no em dash, en dash or emoji", () => {
    expect(GOAL_GUIDE).not.toMatch(/[\u2013\u2014]/);
    expect(GOAL_GUIDE).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
