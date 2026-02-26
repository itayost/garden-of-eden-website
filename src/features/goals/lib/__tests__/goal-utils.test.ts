import { describe, it, expect } from "vitest";
import {
  calculateGoalProgress,
  getGoalCelebrationMessage,
  formatMetricValue,
} from "../utils/goal-utils";
import type { PlayerGoalRow } from "@/types/database";
import type { PhysicalMetricKey } from "../../types";

function createMockGoal(
  overrides: Partial<PlayerGoalRow> & { metric_key?: string; is_lower_better?: boolean } = {}
): PlayerGoalRow {
  const metric = overrides.metric_key ?? "sprint_10m";
  const sprintMetrics = ["sprint_5m", "sprint_10m", "sprint_20m"];
  return {
    id: "goal-1",
    user_id: "user-1",
    metric_key: metric,
    target_value: 2.0,
    baseline_value: 2.5,
    current_value: 2.3,
    is_lower_better: overrides.is_lower_better ?? sprintMetrics.includes(metric),
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    achieved_at: null,
    achieved_value: null,
    ...overrides,
  };
}

describe("calculateGoalProgress", () => {
  it("returns 100% for achieved goal", () => {
    const goal = createMockGoal({
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: 2.0,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(100);
    expect(result.status).toBe("achieved");
    expect(result.is_achieved).toBe(true);
  });

  it("calculates progress for sprint goal (lower is better) with baseline", () => {
    // baseline=2.5, target=2.0, current=2.3
    // totalDistance = |2.0 - 2.5| = 0.5
    // improvement = 2.5 - 2.3 = 0.2
    // progress = 0.2/0.5 * 100 = 40
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      baseline_value: 2.5,
      target_value: 2.0,
      current_value: 2.3,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(40);
    expect(result.status).toBe("in_progress");
  });

  it("calculates progress for jump goal (higher is better) with baseline", () => {
    // baseline=150, target=200, current=175
    // totalDistance = |200 - 150| = 50
    // improvement = 175 - 150 = 25
    // progress = 25/50 * 100 = 50
    const goal = createMockGoal({
      metric_key: "jump_2leg_distance",
      baseline_value: 150,
      target_value: 200,
      current_value: 175,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(50);
    expect(result.status).toBe("in_progress");
  });

  it("returns 0% when no current value and no baseline", () => {
    const goal = createMockGoal({
      current_value: null,
      baseline_value: null,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(0);
    expect(result.status).toBe("not_started");
  });

  it("returns 0% when current equals baseline (no improvement)", () => {
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      baseline_value: 2.5,
      target_value: 2.0,
      current_value: 2.5,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(0);
    expect(result.status).toBe("not_started");
  });

  it("caps progress at 100%", () => {
    // Over-achieved: current is better than target
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      baseline_value: 3.0,
      target_value: 2.5,
      current_value: 2.0,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_percentage).toBe(100);
  });

  it("handles no baseline with current value (higher is better)", () => {
    const goal = createMockGoal({
      metric_key: "jump_2leg_distance",
      baseline_value: null,
      target_value: 200,
      current_value: 150,
    });
    const result = calculateGoalProgress(goal);
    // progress = 150/200 * 100 = 75
    expect(result.progress_percentage).toBe(75);
    expect(result.status).toBe("in_progress");
  });

  it("handles no baseline with current value (lower is better)", () => {
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      baseline_value: null,
      target_value: 2.0,
      current_value: 2.5,
    });
    const result = calculateGoalProgress(goal);
    // progress = (2.0 / 2.5) * 100 = 80
    expect(result.progress_percentage).toBe(80);
    expect(result.status).toBe("in_progress");
  });

  it("includes correct progress_text", () => {
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      target_value: 2.0,
      current_value: 2.3,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_text).toContain("2.3");
    expect(result.progress_text).toContain("2");
    expect(result.progress_text).toContain("שניות");
  });

  it("shows --- for null current_value in progress_text", () => {
    const goal = createMockGoal({
      current_value: null,
      baseline_value: null,
    });
    const result = calculateGoalProgress(goal);
    expect(result.progress_text).toContain("---");
  });

  it("includes Hebrew metric label", () => {
    const goal = createMockGoal({ metric_key: "sprint_10m" });
    const result = calculateGoalProgress(goal);
    expect(result.metric_label_he).toBe("ספרינט 10 מטר");
  });

  it("includes unit", () => {
    const goal = createMockGoal({ metric_key: "jump_2leg_distance" });
    const result = calculateGoalProgress(goal);
    expect(result.unit).toBe('ס"מ');
  });
});

describe("getGoalCelebrationMessage", () => {
  it("returns Hebrew celebration message with metric name", () => {
    const goal = createMockGoal({
      metric_key: "sprint_10m",
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: 2.0,
    });
    const result = getGoalCelebrationMessage(goal);
    expect(result.message).toContain("ספרינט 10 מטר");
    expect(result.message).toContain("2");
  });

  it("returns title in Hebrew", () => {
    const goal = createMockGoal({
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: 2.0,
    });
    const result = getGoalCelebrationMessage(goal);
    expect(result.title).toContain("כל הכבוד");
  });

  it("includes emoji", () => {
    const goal = createMockGoal({
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: 2.0,
    });
    const result = getGoalCelebrationMessage(goal);
    expect(result.emoji).toBeTruthy();
  });

  it("includes duration", () => {
    const goal = createMockGoal({
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: 2.0,
    });
    const result = getGoalCelebrationMessage(goal);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("handles null achieved_value gracefully", () => {
    const goal = createMockGoal({
      achieved_at: "2026-02-01T00:00:00Z",
      achieved_value: null,
    });
    const result = getGoalCelebrationMessage(goal);
    expect(result.message).toBeTruthy();
  });
});

describe("formatMetricValue", () => {
  it("formats sprint value with seconds unit", () => {
    expect(formatMetricValue(2.35, "sprint_10m" as PhysicalMetricKey)).toBe(
      "2.35 שניות"
    );
  });

  it("formats jump value with cm unit", () => {
    expect(
      formatMetricValue(180, "jump_2leg_distance" as PhysicalMetricKey)
    ).toBe('180 ס"מ');
  });

  it("formats kick power with force unit", () => {
    expect(
      formatMetricValue(85, "kick_power_kaiser" as PhysicalMetricKey)
    ).toBe("85 יח׳ כוח");
  });

  it("returns --- for null value", () => {
    expect(formatMetricValue(null, "sprint_10m" as PhysicalMetricKey)).toBe(
      "---"
    );
  });

  it("formats blaze spot with פגיעות unit", () => {
    expect(
      formatMetricValue(30, "blaze_spot_time" as PhysicalMetricKey)
    ).toBe("30 פגיעות");
  });
});
