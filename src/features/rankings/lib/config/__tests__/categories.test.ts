import { describe, it, expect } from "vitest";
import { RANKING_CATEGORIES, CATEGORY_ORDER } from "../categories";

describe("RANKING_CATEGORIES", () => {
  it("ranks the three timed dribbling tests under כדרור, lower is better", () => {
    const dribbling = RANKING_CATEGORIES.dribbling;
    expect(dribbling.labelHe).toBe("כדרור");
    expect(dribbling.metrics).toEqual(["shuffle_10m", "sprint_10m_h", "sprint_10m_h_ball"]);
    expect(dribbling.primaryMetric).toBe("sprint_10m_h_ball");
    expect(dribbling.lowerIsBetter).toBe(true);
  });

  it("lists every category exactly once in CATEGORY_ORDER", () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(RANKING_CATEGORIES).sort());
  });

  it("uses a primary metric that belongs to the category", () => {
    for (const config of Object.values(RANKING_CATEGORIES)) {
      expect(config.metrics).toContain(config.primaryMetric);
    }
  });
});
