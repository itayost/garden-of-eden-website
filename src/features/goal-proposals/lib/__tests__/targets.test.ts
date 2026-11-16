import { describe, it, expect } from "vitest";
import type { MetricRow, ProfileAges } from "../gaps";
import { GOAL_METRICS } from "@/features/goals/lib/config/goal-config";
import {
  MIN_PAIRS,
  TARGET_DECIMALS,
  historyByGroup,
  improvementPairs,
  roundTo,
  targetFor,
} from "../targets";

/** 11 on 2026-01-01 (U12), 12 from 2026-02-01 (U15). */
const PLAYER: ProfileAges = {
  id: "t1",
  birthdate: "2014-02-01",
  age_group_override: null,
  age_group_override_until: null,
};

function row(date: string, values: MetricRow["values"], userId = "t1"): MetricRow {
  return { id: `${userId}-${date}`, userId, date, createdAt: `${date}T10:00:00Z`, values };
}

describe("improvementPairs", () => {
  it("pairs a row with the earliest later row 42 to 84 days after it", () => {
    const rows = [
      row("2026-01-20", { sprint_10m: 2.08 }),
      row("2026-01-01", { sprint_10m: 2.1 }),
      row("2026-02-15", { sprint_10m: 2.0 }),
    ];
    const pairs = improvementPairs([PLAYER], rows, "sprint_10m");
    expect([...pairs.keys()]).toEqual(["u12"]);
    expect(pairs.get("u12")).toHaveLength(1);
    expect(pairs.get("u12")?.[0]).toBeCloseTo(0.1, 10);
  });

  it("takes the earliest of two rows in the window", () => {
    const rows = [
      row("2026-01-01", { jump_2leg_distance: 150 }),
      row("2026-02-20", { jump_2leg_distance: 160 }),
      row("2026-03-10", { jump_2leg_distance: 170 }),
    ];
    expect(improvementPairs([PLAYER], rows, "jump_2leg_distance").get("u12")).toEqual([10]);
  });

  it("makes no pair from rows 30 or 90 days apart", () => {
    const thirty = [row("2026-01-01", { sprint_10m: 2.1 }), row("2026-01-31", { sprint_10m: 2.0 })];
    const ninety = [row("2026-01-01", { sprint_10m: 2.1 }), row("2026-04-01", { sprint_10m: 2.0 })];
    expect(improvementPairs([PLAYER], thirty, "sprint_10m").size).toBe(0);
    expect(improvementPairs([PLAYER], ninety, "sprint_10m").size).toBe(0);
  });

  it("drops a pair whose values differ by more than a factor of 2", () => {
    const rows = [row("2026-01-01", { jump_2leg_distance: 50 }), row("2026-02-15", { jump_2leg_distance: 180 })];
    expect(improvementPairs([PLAYER], rows, "jump_2leg_distance").size).toBe(0);
  });

  it("skips a row without the metric", () => {
    const rows = [
      row("2026-01-01", { sprint_10m: 2.1 }),
      row("2026-02-15", { sprint_10m: null, jump_2leg_distance: 170 }),
      row("2026-03-01", { sprint_10m: 2.05 }),
    ];
    expect(improvementPairs([PLAYER], rows, "sprint_10m").get("u12")?.[0]).toBeCloseTo(0.05, 10);
  });

  it("counts a higher value as the improvement when higher is better", () => {
    const rows = [row("2026-01-01", { jump_2leg_distance: 180 }), row("2026-02-15", { jump_2leg_distance: 175 })];
    expect(improvementPairs([PLAYER], rows, "jump_2leg_distance").get("u12")).toEqual([-5]);
  });

  it("groups a pair by the first row's age group", () => {
    const rows = [row("2026-02-10", { sprint_10m: 2.1 }), row("2026-03-30", { sprint_10m: 2.0 })];
    const early = [row("2026-01-01", { sprint_10m: 2.1 }), row("2026-02-15", { sprint_10m: 2.0 })];
    expect([...improvementPairs([PLAYER], rows, "sprint_10m").keys()]).toEqual(["u15"]);
    expect([...improvementPairs([PLAYER], early, "sprint_10m").keys()]).toEqual(["u12"]);
  });

  it("adds nothing for a Trainee with no profile or no age group", () => {
    const noBirthdate = { ...PLAYER, birthdate: null };
    const rows = [row("2026-01-01", { sprint_10m: 2.1 }), row("2026-02-15", { sprint_10m: 2.0 })];
    expect(improvementPairs([noBirthdate], rows, "sprint_10m").size).toBe(0);
    expect(improvementPairs([], rows, "sprint_10m").size).toBe(0);
  });
});

describe("historyByGroup", () => {
  it("collects the pairs of every Goal metric of the last two years by group", () => {
    const rows = [
      row("2024-01-01", { sprint_10m: 2.2 }),
      row("2024-02-15", { sprint_10m: 2.1 }),
      row("2026-01-01", { sprint_10m: 2.1, jump_2leg_distance: 150 }),
      row("2026-02-15", { sprint_10m: 2.0, jump_2leg_distance: 160 }),
    ];
    const history = historyByGroup([PLAYER], rows, "2026-11-16");
    const u12 = history.get("u12");
    expect(u12?.get("sprint_10m")).toHaveLength(1);
    expect(u12?.get("jump_2leg_distance")).toEqual([10]);
    expect(history.get("u10")).toBeUndefined();
  });
});

describe("TARGET_DECIMALS and roundTo", () => {
  it("has a precision for every Goal metric", () => {
    expect(Object.keys(TARGET_DECIMALS).sort()).toEqual([...GOAL_METRICS].sort());
    expect(TARGET_DECIMALS.sprint_10m).toBe(2);
    expect(TARGET_DECIMALS.envelope_ball).toBe(2);
    expect(TARGET_DECIMALS.flexibility_hip).toBe(1);
    expect(TARGET_DECIMALS.jump_2leg_height).toBe(0);
    expect(TARGET_DECIMALS.kick_power_left_foot).toBe(0);
    expect(TARGET_DECIMALS.blaze_spot_time).toBe(0);
  });

  it("rounds to the given decimals", () => {
    expect(roundTo(2.0876, 2)).toBe(2.09);
    expect(roundTo(7.5, 0)).toBe(8);
    expect(roundTo(12.34, 1)).toBe(12.3);
  });
});

/** 20 improvements whose 60th percentile is 0.04 and 75th is 0.08. */
const TWENTY = [...Array<number>(11).fill(0.02), 0.04, 0.04, 0.06, ...Array<number>(6).fill(0.08)];

describe("targetFor", () => {
  it("takes half the gap with little history", () => {
    expect(targetFor({ metric: "sprint_10m", value: 2.1, gap: 0.2, history: [0.1, 0.2, 0.05, 0.01, 0] })).toEqual({
      step: 0.1,
      target: 2,
      basis: "half_gap",
      pairs: 5,
    });
  });

  it("holds half the gap inside the history band", () => {
    expect(TWENTY).toHaveLength(MIN_PAIRS);
    expect(targetFor({ metric: "sprint_10m", value: 2.1, gap: 0.2, history: TWENTY })).toEqual({
      step: 0.08,
      target: 2.02,
      basis: "history",
      pairs: 20,
    });
  });

  it("raises a small half gap to the 60th percentile", () => {
    expect(targetFor({ metric: "sprint_10m", value: 2.1, gap: 0.04, history: TWENTY })).toEqual({
      step: 0.04,
      target: 2.06,
      basis: "history",
      pairs: 20,
    });
  });

  it("gives no target when the history's 75th percentile is not positive", () => {
    const flat = [...Array<number>(15).fill(-0.05), ...Array<number>(5).fill(0)];
    expect(targetFor({ metric: "sprint_10m", value: 2.1, gap: 0.2, history: flat })).toBeNull();
  });

  it("rounds a jump to whole centimeters", () => {
    expect(targetFor({ metric: "jump_2leg_distance", value: 180, gap: 15, history: [4, 6] })).toEqual({
      step: 8,
      target: 188,
      basis: "half_gap",
      pairs: 2,
    });
  });

  it("gives no target for a step that rounds to nothing", () => {
    expect(targetFor({ metric: "sprint_10m", value: 2.1, gap: 0.005, history: [] })).toBeNull();
  });

  it("gives no target that is not positive", () => {
    expect(targetFor({ metric: "sprint_10m", value: 0.2, gap: 0.6, history: [] })).toBeNull();
  });
});
