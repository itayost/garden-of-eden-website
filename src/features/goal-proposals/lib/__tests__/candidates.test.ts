import { describe, it, expect } from "vitest";
import type { MetricDrill } from "@/features/development-book/lib/drill-candidates";
import type { GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import {
  MAX_CANDIDATES,
  OFFERED_DRILLS_PER_GOAL,
  basisText,
  excludedMetrics,
  proposalCandidates,
} from "../candidates";
import type { Gap } from "../gaps";

function gap(metric: GoalMetric, value: number, benchmark: number, overrides: Partial<Gap> = {}): Gap {
  return {
    metric,
    value,
    benchmark,
    gap: Math.abs(value - benchmark),
    betterThanPercent: 20,
    groupSize: 30,
    fit: "all",
    ...overrides,
  };
}

function drill(metricKey: string, n: number): MetricDrill {
  return { id: `${metricKey}-d${n}`, name: `תרגיל ${n}`, why: n === 1 ? null : `סיבה ${n}`, metricKey, parameterName: "מהירות" };
}

const NO_DRILLS = () => [];
const NO_HISTORY = new Map<PhysicalMetricKey, readonly number[]>();
/** 20 improvements whose 60th percentile is 0.04 and 75th is 0.08. */
const TWENTY = [...Array<number>(11).fill(0.02), 0.04, 0.04, 0.06, ...Array<number>(6).fill(0.08)];

describe("basisText", () => {
  it("names the pairs of a history target", () => {
    expect(basisText({ step: 0.08, target: 2.02, basis: "history", pairs: 24 })).toBe(
      "השיפור של שחקני הקבוצה בין מבדקים בהפרש של 6 עד 12 שבועות (24 זוגות)",
    );
  });

  it("says half the gap otherwise", () => {
    expect(basisText({ step: 0.1, target: 2, basis: "half_gap", pairs: 3 })).toBe("חצי מהפער לרף הקבוצה");
  });
});

describe("proposalCandidates", () => {
  const gaps = [
    gap("sprint_5m", 1.3, 1.1),
    gap("sprint_10m", 2.0, 1.995),
    gap("sprint_20m", 3.6, 3.3),
    gap("jump_2leg_distance", 150, 180),
    gap("jump_2leg_height", 20, 30),
    gap("jump_right_leg", 100, 130),
    gap("jump_left_leg", 100, 130),
    gap("blaze_spot_time", 20, 30),
    gap("flexibility_hip", 10, 14),
  ];

  it("keeps the gaps' order and at most six", () => {
    const result = proposalCandidates({ gaps, history: NO_HISTORY, drills: NO_DRILLS });
    expect(result).toHaveLength(MAX_CANDIDATES);
    expect(result.map((c) => c.metric_key)).toEqual([
      "sprint_5m",
      "sprint_20m",
      "jump_2leg_distance",
      "jump_2leg_height",
      "jump_right_leg",
      "jump_left_leg",
    ]);
  });

  it("skips a gap whose target is null", () => {
    const result = proposalCandidates({ gaps: gaps.slice(0, 3), history: NO_HISTORY, drills: NO_DRILLS });
    expect(result.map((c) => c.metric_key)).toEqual(["sprint_5m", "sprint_20m"]);
  });

  it("states the facts in Hebrew, rounded per metric", () => {
    const [facts] = proposalCandidates({
      gaps: [gap("sprint_20m", 3.4561, 3.2049, { betterThanPercent: 12, groupSize: 41, fit: "position" })],
      history: new Map([["sprint_20m", TWENTY]]),
      drills: NO_DRILLS,
    });
    expect(facts).toEqual({
      metric_key: "sprint_20m",
      metric: "ספרינט 20 מטר",
      unit: "שניות",
      direction: "נמוך יותר טוב יותר",
      value: 3.46,
      benchmark: 3.2,
      betterThanPercent: 12,
      groupSize: 41,
      step: 0.08,
      target: 3.38,
      basis: "השיפור של שחקני הקבוצה בין מבדקים בהפרש של 6 עד 12 שבועות (20 זוגות)",
      positionFit: "מתאים לעמדה",
      drills: [],
    });
  });

  it("states a higher-is-better metric and its fit", () => {
    const [facts] = proposalCandidates({
      gaps: [gap("jump_2leg_distance", 150.4, 180.2, { fit: "none" })],
      history: NO_HISTORY,
      drills: NO_DRILLS,
    });
    expect(facts.direction).toBe("גבוה יותר טוב יותר");
    expect(facts.unit).toBe('ס"מ');
    expect(facts.value).toBe(150);
    expect(facts.benchmark).toBe(180);
    expect(facts.step).toBe(15);
    expect(facts.target).toBe(165);
    expect(facts.basis).toBe("חצי מהפער לרף הקבוצה");
    expect(facts.positionFit).toBe("אין פרמטר בספר");
  });

  it("says a metric for every position", () => {
    const [facts] = proposalCandidates({ gaps: [gap("sprint_5m", 1.3, 1.1)], history: NO_HISTORY, drills: NO_DRILLS });
    expect(facts.positionFit).toBe("לכל העמדות");
  });

  it("offers at most five drills with their parameter", () => {
    const [facts] = proposalCandidates({
      gaps: [gap("sprint_5m", 1.3, 1.1)],
      history: NO_HISTORY,
      drills: (metric) => [1, 2, 3, 4, 5, 6, 7].map((n) => drill(metric, n)),
    });
    expect(facts.drills).toHaveLength(OFFERED_DRILLS_PER_GOAL);
    expect(facts.drills[0]).toEqual({ id: "sprint_5m-d1", name: "תרגיל 1", why: null, parameter: "מהירות" });
    expect(facts.drills[1]).toEqual({ id: "sprint_5m-d2", name: "תרגיל 2", why: "סיבה 2", parameter: "מהירות" });
  });

  it("keeps the target a whole step from the stated value", () => {
    const [facts] = proposalCandidates({ gaps: [gap("sprint_10m", 2.105, 1.9)], history: NO_HISTORY, drills: NO_DRILLS });
    // 2.105 is stated as 2.11; a target from the raw value would round 2.005 down to 2.
    expect(facts.value).toBe(2.11);
    expect(facts.step).toBe(0.1);
    expect(facts.target).toBe(2.01);
  });
});

describe("excludedMetrics", () => {
  const today = "2026-11-16";

  it("holds the open Goals' metrics", () => {
    expect(excludedMetrics({ openGoalMetrics: ["sprint_10m"], rejected: [], today })).toEqual(new Set(["sprint_10m"]));
  });

  it("holds a metric rejected in the last 60 days", () => {
    const result = excludedMetrics({
      openGoalMetrics: [],
      rejected: [
        { metricKey: "jump_2leg_height", decidedOn: "2026-09-18" },
        { metricKey: "sprint_20m", decidedOn: "2026-09-17" },
        { metricKey: "sprint_5m", decidedOn: "2026-09-16" },
      ],
      today,
    });
    expect(result).toEqual(new Set(["jump_2leg_height", "sprint_20m"]));
  });
});
