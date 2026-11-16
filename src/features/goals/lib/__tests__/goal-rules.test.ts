import { describe, it, expect } from "vitest";
import { goalRefusal } from "../utils/goal-rules";
import { GOAL_METRICS, isGoalMetric } from "../config/goal-config";

const LOWER = "עבור מדד זה, היעד צריך להיות נמוך מהערך הנוכחי";
const HIGHER = "עבור מדד זה, היעד צריך להיות גבוה מהערך הנוכחי";

describe("isGoalMetric", () => {
  it("accepts the Goal metrics", () => {
    expect(isGoalMetric("sprint_10m")).toBe(true);
    expect(isGoalMetric("envelope_ball")).toBe(true);
  });

  it("refuses kick_power_kaiser and unknown keys", () => {
    expect(isGoalMetric("kick_power_kaiser")).toBe(false);
    expect(isGoalMetric("speed")).toBe(false);
  });

  it("holds the 18 Goal metrics", () => {
    expect(GOAL_METRICS).toHaveLength(18);
  });
});

describe("goalRefusal", () => {
  it("refuses a metric that is not a Goal metric", () => {
    expect(goalRefusal({ metricKey: "kick_power_kaiser", targetValue: 50, baselineValue: null })).toBe(
      "מדד לא תקין",
    );
  });

  it("refuses a target that is not a finite number above 0", () => {
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 0, baselineValue: null })).toBe(
      "ערך היעד חייב להיות חיובי",
    );
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: Number.NaN, baselineValue: null })).toBe(
      "ערך היעד חייב להיות חיובי",
    );
    expect(
      goalRefusal({ metricKey: "sprint_10m", targetValue: Number.POSITIVE_INFINITY, baselineValue: null }),
    ).toBe("ערך היעד חייב להיות חיובי");
  });

  it("checks the metric before the target", () => {
    expect(goalRefusal({ metricKey: "speed", targetValue: 0, baselineValue: null })).toBe("מדד לא תקין");
  });

  it("wants a lower target on a lower-is-better metric", () => {
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 2.1, baselineValue: 2 })).toBe(LOWER);
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 2, baselineValue: 2 })).toBe(LOWER);
  });

  it("wants a higher target on a higher-is-better metric", () => {
    expect(goalRefusal({ metricKey: "jump_2leg_distance", targetValue: 175, baselineValue: 180 })).toBe(HIGHER);
    expect(goalRefusal({ metricKey: "jump_2leg_distance", targetValue: 180, baselineValue: 180 })).toBe(HIGHER);
  });

  it("checks only the metric and the target without a baseline above 0", () => {
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 2.5, baselineValue: null })).toBeNull();
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 2.5, baselineValue: 0 })).toBeNull();
    expect(goalRefusal({ metricKey: "jump_2leg_distance", targetValue: 100, baselineValue: 0 })).toBeNull();
  });

  it("accepts a target on the right side of the baseline", () => {
    expect(goalRefusal({ metricKey: "sprint_10m", targetValue: 1.9, baselineValue: 2 })).toBeNull();
    expect(goalRefusal({ metricKey: "jump_2leg_distance", targetValue: 190, baselineValue: 180 })).toBeNull();
  });
});
