import { describe, it, expect } from "vitest";
import { getMetricDirection, compareMetric } from "../metric-comparison";

describe("getMetricDirection", () => {
  it("sprint metrics are lower_is_better", () => {
    expect(getMetricDirection("sprint_5m")).toBe("lower_is_better");
    expect(getMetricDirection("sprint_10m")).toBe("lower_is_better");
    expect(getMetricDirection("sprint_20m")).toBe("lower_is_better");
    expect(getMetricDirection("blaze_spot_time")).toBe("lower_is_better");
  });

  it("jump and power metrics are higher_is_better", () => {
    expect(getMetricDirection("jump_2leg_height")).toBe("higher_is_better");
    expect(getMetricDirection("jump_2leg_distance")).toBe("higher_is_better");
    expect(getMetricDirection("jump_right_leg")).toBe("higher_is_better");
    expect(getMetricDirection("jump_left_leg")).toBe("higher_is_better");
    expect(getMetricDirection("kick_power_kaiser")).toBe("higher_is_better");
  });

  it("flexibility metrics are higher_is_better", () => {
    expect(getMetricDirection("flexibility_ankle")).toBe("higher_is_better");
    expect(getMetricDirection("flexibility_knee")).toBe("higher_is_better");
    expect(getMetricDirection("flexibility_hip")).toBe("higher_is_better");
  });

  it("coordination and body metrics are categorical", () => {
    expect(getMetricDirection("coordination")).toBe("categorical");
    expect(getMetricDirection("body_structure")).toBe("categorical");
    expect(getMetricDirection("leg_power_technique")).toBe("categorical");
  });

  it("unknown keys default to categorical", () => {
    expect(getMetricDirection("unknown_metric")).toBe("categorical");
  });
});

describe("compareMetric", () => {
  describe("lower_is_better metrics (sprints)", () => {
    it("returns 'improved' when latest is lower", () => {
      expect(compareMetric("sprint_10m", 1.84, 1.91)).toBe("improved");
    });

    it("returns 'declined' when latest is higher", () => {
      expect(compareMetric("sprint_10m", 1.95, 1.91)).toBe("declined");
    });

    it("returns 'unchanged' when values are equal", () => {
      expect(compareMetric("sprint_10m", 1.91, 1.91)).toBe("unchanged");
    });

    it("handles string numbers", () => {
      expect(compareMetric("sprint_5m", "1.12", "1.18")).toBe("improved");
    });
  });

  describe("higher_is_better metrics (jumps)", () => {
    it("returns 'improved' when latest is higher", () => {
      expect(compareMetric("jump_2leg_height", 48, 45)).toBe("improved");
    });

    it("returns 'declined' when latest is lower", () => {
      expect(compareMetric("jump_2leg_height", 43, 45)).toBe("declined");
    });

    it("returns 'unchanged' when values are equal", () => {
      expect(compareMetric("kick_power_kaiser", 340, 340)).toBe("unchanged");
    });
  });

  describe("categorical metrics", () => {
    it("returns 'categorical' regardless of values", () => {
      expect(compareMetric("coordination", "advanced", "basic")).toBe("categorical");
      expect(compareMetric("body_structure", "basic", "basic")).toBe("categorical");
    });
  });

  describe("null / missing values", () => {
    it("returns null when latest is null", () => {
      expect(compareMetric("sprint_10m", null, 1.91)).toBeNull();
    });

    it("returns null when previous is null", () => {
      expect(compareMetric("sprint_10m", 1.84, null)).toBeNull();
    });

    it("returns null when both are null", () => {
      expect(compareMetric("sprint_10m", null, null)).toBeNull();
    });
  });
});
