import { describe, expect, it } from "vitest";
import { GOAL_METRICS } from "@/features/goals/lib/config/goal-config";
import {
  HIDDEN_WARNING,
  metricMapRows,
  NO_DRILLS_WARNING,
  parameterWarnings,
  type MapParameter,
} from "../metric-map";

function parameter(overrides: Partial<MapParameter> & Pick<MapParameter, "id">): MapParameter {
  return {
    nameHe: `פרמטר ${overrides.id}`,
    categoryName: "כוח",
    order: 1000,
    isAllPositions: true,
    positions: [],
    drillCount: 2,
    ...overrides,
  };
}

const EARLY = parameter({ id: "p-early", nameHe: "האצה", order: 1001 });
const LATE = parameter({ id: "p-late", nameHe: "מהירות", order: 2001 });
const HIDDEN = parameter({ id: "p-hidden", nameHe: "בעיטה", order: 3001, isAllPositions: false, positions: [] });
const EMPTY = parameter({ id: "p-empty", nameHe: "ניתור", order: 1002, drillCount: 0 });
const WINGS = parameter({ id: "p-wings", nameHe: "הגבהה", order: 3002, isAllPositions: false, positions: ["LW", "RW"] });

describe("parameterWarnings", () => {
  it("warns on a parameter hidden from every player with a position", () => {
    expect(parameterWarnings(HIDDEN)).toEqual([HIDDEN_WARNING]);
    expect(HIDDEN_WARNING).toBe("מוסתר מכל שחקן שיש לו עמדה");
  });

  it("warns on a parameter with no drills", () => {
    expect(parameterWarnings(EMPTY)).toEqual([NO_DRILLS_WARNING]);
    expect(NO_DRILLS_WARNING).toBe("אין תרגילים");
  });

  it("gives both warnings together, and none for a parameter that names positions", () => {
    expect(parameterWarnings({ ...HIDDEN, drillCount: 0 })).toEqual([HIDDEN_WARNING, NO_DRILLS_WARNING]);
    expect(parameterWarnings(WINGS)).toEqual([]);
    expect(parameterWarnings(EARLY)).toEqual([]);
  });
});

describe("metricMapRows", () => {
  const parameters = [LATE, HIDDEN, EARLY, EMPTY, WINGS];

  it("gives one row per Goal metric, in GOAL_METRICS order, with label and unit", () => {
    const rows = metricMapRows(parameters, []);
    expect(rows).toHaveLength(18);
    expect(rows.map((row) => row.metricKey)).toEqual([...GOAL_METRICS]);
    const sprint = rows.find((row) => row.metricKey === "sprint_10m");
    expect(sprint?.label).toBe("ספרינט 10 מטר");
    expect(sprint?.unit).toBe("שניות");
    expect(sprint?.parameters).toEqual([]);
  });

  it("sorts a metric's parameters by book order", () => {
    const rows = metricMapRows(parameters, [
      { parameterId: "p-late", metricKey: "sprint_10m" },
      { parameterId: "p-early", metricKey: "sprint_10m" },
      { parameterId: "p-empty", metricKey: "sprint_10m" },
    ]);
    const sprint = rows.find((row) => row.metricKey === "sprint_10m");
    expect(sprint?.parameters.map((p) => p.id)).toEqual(["p-early", "p-empty", "p-late"]);
  });

  it("puts each pair under its own metric and carries the warnings", () => {
    const rows = metricMapRows(parameters, [
      { parameterId: "p-hidden", metricKey: "kick_power_right_foot" },
      { parameterId: "p-empty", metricKey: "jump_2leg_height" },
    ]);
    const kick = rows.find((row) => row.metricKey === "kick_power_right_foot");
    const jump = rows.find((row) => row.metricKey === "jump_2leg_height");
    expect(kick?.parameters.map((p) => [p.id, p.warnings])).toEqual([["p-hidden", [HIDDEN_WARNING]]]);
    expect(jump?.parameters.map((p) => [p.id, p.warnings])).toEqual([["p-empty", [NO_DRILLS_WARNING]]]);
  });

  it("ignores a pair whose parameter no longer exists, and a metric that is not a Goal metric", () => {
    const rows = metricMapRows(parameters, [
      { parameterId: "p-gone", metricKey: "sprint_10m" },
      { parameterId: "p-early", metricKey: "kick_power_kaiser" },
      { parameterId: "p-early", metricKey: "sprint_10m" },
    ]);
    const sprint = rows.find((row) => row.metricKey === "sprint_10m");
    expect(sprint?.parameters.map((p) => p.id)).toEqual(["p-early"]);
    expect(rows.flatMap((row) => row.parameters)).toHaveLength(1);
  });

  it("lists a parameter once per metric even if the pair repeats", () => {
    const rows = metricMapRows(parameters, [
      { parameterId: "p-early", metricKey: "sprint_5m" },
      { parameterId: "p-early", metricKey: "sprint_5m" },
    ]);
    expect(rows.find((row) => row.metricKey === "sprint_5m")?.parameters).toHaveLength(1);
  });
});
