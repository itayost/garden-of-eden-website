import { describe, it, expect } from "vitest";
import { GOAL_METRICS, METRIC_LABELS_HE, METRIC_UNITS, isLowerBetterMetric } from "../goal-config";
import { DRIBBLING_TEST_KEYS as DRIBBLING } from "@/types/assessment";

describe("goal config for the dribbling tests", () => {
  it("lets a goal be set on each dribbling test", () => {
    for (const key of DRIBBLING) expect(GOAL_METRICS).toContain(key);
  });

  it("stores dribbling goals as lower-is-better", () => {
    for (const key of DRIBBLING) expect(isLowerBetterMetric(key)).toBe(true);
  });

  it("labels them in Hebrew, in seconds", () => {
    for (const key of DRIBBLING) {
      expect(METRIC_LABELS_HE[key]).toBeTruthy();
      expect(METRIC_UNITS[key]).toBe("שניות");
    }
  });
});
