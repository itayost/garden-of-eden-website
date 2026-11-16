import { describe, it, expect } from "vitest";
import {
  findGaps,
  groupMetric,
  groupMetrics,
  plausibleBand,
  quantile,
  type GroupMetric,
  type MetricRow,
  type ProfileAges,
} from "../gaps";

const TODAY = "2026-11-16";

function profile(id: string, overrides: Partial<ProfileAges> = {}): ProfileAges {
  return {
    id,
    birthdate: "2015-03-10",
    age_group_override: null,
    age_group_override_until: null,
    ...overrides,
  };
}

function row(userId: string, date: string, values: MetricRow["values"], createdAt = `${date}T10:00:00Z`): MetricRow {
  return { id: `${userId}-${date}-${createdAt}`, userId, date, createdAt, values };
}

const SPRINTS = [1.8, 1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.15];
const JUMPS = [150, 160, 170, 175, 180, 185, 190, 200];

describe("quantile", () => {
  it("interpolates between the closest ranks", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.3)).toBe(10);
  });
});

describe("plausibleBand", () => {
  it("is half and twice the median", () => {
    expect(plausibleBand([4, 1, 3, 2])).toEqual({ low: 1.25, high: 5 });
  });

  it("is null for an empty list", () => {
    expect(plausibleBand([])).toBeNull();
  });
});

describe("groupMetric", () => {
  it("needs at least eight values", () => {
    expect(groupMetric("sprint_10m", SPRINTS.slice(0, 7))).toBeNull();
  });

  it("takes the 25th percentile of a timed test", () => {
    const result = groupMetric("sprint_10m", [...SPRINTS].reverse());
    expect(result?.benchmark).toBeCloseTo(1.8875, 10);
    expect(result?.values).toEqual(SPRINTS);
  });

  it("takes the 75th percentile when higher is better", () => {
    expect(groupMetric("jump_2leg_distance", JUMPS)?.benchmark).toBeCloseTo(186.25, 10);
  });

  it("drops a value outside the plausible band", () => {
    const result = groupMetric("jump_2leg_distance", [...JUMPS, 50]);
    expect(result?.values).toEqual(JUMPS);
    expect(result?.band.low).toBeLessThan(150);
  });

  it("is null when the plausible values are fewer than eight", () => {
    expect(groupMetric("jump_2leg_distance", [...JUMPS.slice(0, 7), 50, 20])).toBeNull();
  });
});

describe("groupMetrics", () => {
  const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];

  it("groups each Trainee by today's age group and takes the latest value", () => {
    const profiles = ids.map((id) => profile(id));
    const rows = [
      row("t1", "2026-05-01", { sprint_10m: 2.5 }),
      row("t1", "2026-10-01", { sprint_10m: 2.0 }),
      ...ids.slice(1).map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] })),
    ];
    const u12 = groupMetrics(profiles, rows, TODAY).get("u12");
    expect(u12?.get("sprint_10m")?.values).toEqual([1.8, 1.85, 1.9, 1.95, 2.0, 2.0, 2.05, 2.1]);
  });

  it("breaks a same-date tie by the later createdAt", () => {
    const profiles = ids.map((id) => profile(id));
    const rows = [
      row("t1", "2026-10-01", { sprint_10m: 2.12 }, "2026-10-01T12:00:00Z"),
      row("t1", "2026-10-01", { sprint_10m: 2.5 }, "2026-10-01T08:00:00Z"),
      ...ids.slice(1).map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] })),
    ];
    const values = groupMetrics(profiles, rows, TODAY).get("u12")?.get("sprint_10m")?.values;
    expect(values).toContain(2.12);
    expect(values).not.toContain(2.5);
  });

  it("takes the latest row that has the metric", () => {
    const profiles = ids.map((id) => profile(id));
    const rows = [
      row("t1", "2026-06-01", { sprint_10m: 2.3 }),
      row("t1", "2026-10-01", { sprint_10m: null, jump_2leg_distance: 170 }),
      ...ids.slice(1).map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] })),
    ];
    expect(groupMetrics(profiles, rows, TODAY).get("u12")?.get("sprint_10m")?.values).toContain(2.3);
  });

  it("skips a row older than a year", () => {
    const profiles = ids.map((id) => profile(id));
    const rows = [
      row("t1", "2025-11-01", { sprint_10m: 2.0 }),
      ...ids.slice(1).map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] })),
    ];
    expect(groupMetrics(profiles, rows, TODAY).get("u12")?.get("sprint_10m")).toBeUndefined();
  });

  it("follows a staff-set age group", () => {
    const profiles = ids.map((id) =>
      id === "t1" ? profile(id, { age_group_override: "u15", age_group_override_until: "2027-03-10" }) : profile(id),
    );
    const rows = ids.map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] }));
    const groups = groupMetrics(profiles, rows, TODAY);
    expect(groups.get("u12")?.get("sprint_10m")).toBeUndefined();
    expect(groups.get("u15")?.get("sprint_10m")).toBeUndefined();
  });

  it("leaves out a Trainee with no profile or no age group", () => {
    const profiles = [...ids.map((id) => profile(id)), profile("t9", { birthdate: null })];
    const rows = [
      ...ids.map((id, i) => row(id, "2026-09-01", { sprint_10m: SPRINTS[i] })),
      row("t9", "2026-09-01", { sprint_10m: 2.01 }),
      row("t10", "2026-09-01", { sprint_10m: 2.02 }),
    ];
    expect(groupMetrics(profiles, rows, TODAY).get("u12")?.get("sprint_10m")?.values).toEqual(SPRINTS);
  });
});

describe("findGaps", () => {
  const sprint = groupMetric("sprint_10m", SPRINTS) as GroupMetric;
  const jump = groupMetric("jump_2leg_distance", JUMPS) as GroupMetric;
  const group = new Map([
    ["sprint_10m" as const, sprint],
    ["jump_2leg_distance" as const, jump],
  ]);
  const allFit = new Map<string, "position" | "all" | "none">([
    ["sprint_10m", "all"],
    ["jump_2leg_distance", "all"],
  ]);

  it("finds a value worse than the benchmark with its distance", () => {
    const gaps = findGaps({ values: { sprint_10m: 2.0 }, group, fits: allFit, exclude: new Set() });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].metric).toBe("sprint_10m");
    expect(gaps[0].gap).toBeCloseTo(0.1125, 10);
    expect(gaps[0].benchmark).toBeCloseTo(1.8875, 10);
    expect(gaps[0].betterThanPercent).toBe(38);
    expect(gaps[0].groupSize).toBe(8);
    expect(gaps[0].fit).toBe("all");
  });

  it("finds no gap for a value better than the benchmark", () => {
    expect(findGaps({ values: { sprint_10m: 1.8, jump_2leg_distance: 195 }, group, fits: allFit, exclude: new Set() })).toEqual(
      [],
    );
  });

  it("skips an excluded metric", () => {
    const gaps = findGaps({
      values: { sprint_10m: 2.0, jump_2leg_distance: 160 },
      group,
      fits: allFit,
      exclude: new Set(["sprint_10m"]),
    });
    expect(gaps.map((g) => g.metric)).toEqual(["jump_2leg_distance"]);
  });

  it("skips a value outside the group's band and a missing value", () => {
    expect(findGaps({ values: { jump_2leg_distance: 50, sprint_10m: null }, group, fits: allFit, exclude: new Set() })).toEqual(
      [],
    );
  });

  it("skips a metric with no group benchmark", () => {
    expect(findGaps({ values: { sprint_20m: 5 }, group, fits: allFit, exclude: new Set() })).toEqual([]);
  });

  it("sorts by standing within one fit", () => {
    const gaps = findGaps({ values: { sprint_10m: 2.0, jump_2leg_distance: 160 }, group, fits: allFit, exclude: new Set() });
    expect(gaps.map((g) => [g.metric, g.betterThanPercent])).toEqual([
      ["jump_2leg_distance", 13],
      ["sprint_10m", 38],
    ]);
  });

  it("puts a position metric before an all-positions metric with a lower standing", () => {
    const fits = new Map<string, "position" | "all" | "none">([
      ["sprint_10m", "position"],
      ["jump_2leg_distance", "all"],
    ]);
    const gaps = findGaps({ values: { sprint_10m: 2.0, jump_2leg_distance: 160 }, group, fits, exclude: new Set() });
    expect(gaps.map((g) => g.metric)).toEqual(["sprint_10m", "jump_2leg_distance"]);
  });

  it("puts a metric with no fit last", () => {
    const fits = new Map<string, "position" | "all" | "none">([["sprint_10m", "all"]]);
    const gaps = findGaps({ values: { sprint_10m: 2.0, jump_2leg_distance: 160 }, group, fits, exclude: new Set() });
    expect(gaps.map((g) => [g.metric, g.fit])).toEqual([
      ["sprint_10m", "all"],
      ["jump_2leg_distance", "none"],
    ]);
  });
});
