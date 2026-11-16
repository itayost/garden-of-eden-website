import { describe, expect, test } from "vitest";
import type { DrillPool, PoolParameter } from "@/features/development-book/lib/drill-candidates";
import { MAX_SHEET_DRILLS, sheetDrills } from "../drills";
import { goal } from "./fixtures";

const WEEK_END = "2026-11-19";
const SPRINT = "ספרינט 10 מטר";
const KICK = "עוצמת בעיטה - רגל ימין";

function parameter(overrides: Partial<PoolParameter> & Pick<PoolParameter, "id" | "order">): PoolParameter {
  return { nameHe: overrides.id, isAllPositions: true, positions: [], ageGroups: [], metricKeys: [], ...overrides };
}

function drills(parameterId: string, names: readonly string[]) {
  return names.map((id, index) => ({ id, parameterId, name: `תרגיל ${id}`, why: null, order: index }));
}

const POOL: DrillPool = {
  parameters: [
    parameter({ id: "speed", order: 1, metricKeys: ["sprint_10m"] }),
    parameter({ id: "kick", order: 2, metricKeys: ["kick_power_right_foot"] }),
    parameter({ id: "wing", order: 3, isAllPositions: false, positions: ["LW", "RW"], metricKeys: ["sprint_10m"] }),
    parameter({ id: "older", order: 4, ageGroups: ["U15+"], metricKeys: ["sprint_10m"] }),
  ],
  drills: [
    ...drills("speed", ["s1", "s2", "s3", "s4"]),
    ...drills("kick", ["k1", "k2", "k3", "k4"]),
    ...drills("wing", ["w1"]),
    ...drills("older", ["o1"]),
  ],
};

const SPRINT_GOAL = goal({ id: "goal-sprint", metric_key: "sprint_10m", created_at: "2026-09-01T10:00:00Z" });
const KICK_GOAL = goal({
  id: "goal-kick",
  metric_key: "kick_power_right_foot",
  target_value: 80,
  baseline_value: 70,
  is_lower_better: false,
  created_at: "2026-10-01T10:00:00Z",
});

function sheet(overrides: Partial<Parameters<typeof sheetDrills>[1]> = {}) {
  return sheetDrills(POOL, {
    // Newest first on purpose: the rule orders the Goals oldest first.
    goals: [KICK_GOAL, SPRINT_GOAL],
    birthdate: "2013-05-01",
    position: "CB",
    weekEnd: WEEK_END,
    doneIds: new Set(),
    goalDrills: new Map(),
    ...overrides,
  });
}

const ids = (list: readonly { id: string }[]) => list.map((drill) => drill.id);

describe("sheetDrills", () => {
  test("one drill per open Goal in turn, oldest Goal first, each with its Goal", () => {
    const result = sheet();
    expect(ids(result)).toEqual(["s1", "k1", "s2", "k2", "s3", "k3"]);
    expect(result[0]).toEqual({ id: "s1", name: "תרגיל s1", why: null, goal: SPRINT });
    expect(result[1].goal).toBe(KICK);
  });

  test("never more than 6", () => {
    expect(MAX_SHEET_DRILLS).toBe(6);
    expect(sheet()).toHaveLength(6);
  });

  test("an achieved Goal adds nothing", () => {
    const achieved = { ...KICK_GOAL, achieved_at: "2026-11-01T10:00:00Z", achieved_value: 81 };
    expect(ids(sheet({ goals: [achieved, SPRINT_GOAL] }))).toEqual(["s1", "s2", "s3", "s4"]);
  });

  test("a drill done lately is left out", () => {
    expect(ids(sheet({ doneIds: new Set(["s1", "k1"]) }))).toEqual(["s2", "k2", "s3", "k3", "s4", "k4"]);
  });

  test("a drill of the Goal's accepted proposal comes first for that Goal", () => {
    const goalDrills = new Map([["goal-kick", ["k3"]]]);
    expect(ids(sheet({ goalDrills }))).toEqual(["s1", "k3", "s2", "k1", "s3", "k2"]);
  });

  test("a 15 year old gets the drills of a U15+ parameter, a 13 year old does not", () => {
    expect(ids(sheet({ goals: [SPRINT_GOAL], birthdate: "2011-11-19" }))).toContain("o1");
    expect(ids(sheet({ goals: [SPRINT_GOAL] }))).not.toContain("o1");
  });

  test("a CB gets no drill of a wing parameter, a wing does", () => {
    expect(ids(sheet({ goals: [SPRINT_GOAL] }))).not.toContain("w1");
    expect(ids(sheet({ goals: [SPRINT_GOAL], position: "LW" }))).toContain("w1");
  });

  test("no open Goal gives no drills", () => {
    expect(sheet({ goals: [] })).toEqual([]);
  });
});
