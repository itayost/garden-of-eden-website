import { describe, expect, test } from "vitest";
import {
  drillCandidatesFor,
  drillName,
  drillWhy,
  drillsForMetric,
  fitsAge,
  metricPositionFit,
  type DrillPool,
  type PoolParameter,
} from "../drill-candidates";

function parameter(overrides: Partial<PoolParameter> & Pick<PoolParameter, "id" | "order">): PoolParameter {
  return {
    nameHe: `פרמטר ${overrides.id}`,
    isAllPositions: true,
    positions: [],
    ageGroups: [],
    metricKeys: [],
    ...overrides,
  };
}

const POOL: DrillPool = {
  parameters: [
    parameter({ id: "P1", order: 1, metricKeys: ["sprint_10m"] }),
    parameter({ id: "P2", order: 2, isAllPositions: false, positions: ["LW", "RW"], metricKeys: ["kick_power_right_foot"] }),
    parameter({ id: "P3", order: 3, isAllPositions: false, positions: [], metricKeys: ["sprint_10m"] }),
    parameter({ id: "P4", order: 4, ageGroups: ["U10-12"], metricKeys: ["jump_2leg_distance"] }),
    parameter({ id: "P5", order: 5, ageGroups: ["U10-12", "U13-14", "U15+"], metricKeys: ["sprint_10m"] }),
    parameter({
      id: "P6",
      order: 6,
      isAllPositions: false,
      positions: ["LW"],
      ageGroups: ["U17+"],
      metricKeys: ["kick_power_left_foot"],
    }),
    parameter({ id: "P7", order: 7, ageGroups: ["U8", "בוגרים"], metricKeys: ["jump_2leg_height"] }),
  ],
  // Out of order on purpose: the rules sort by parameter order, then drill order.
  drills: [
    { id: "d6", parameterId: "P5", name: "תרגיל 6", why: null, order: 1 },
    { id: "d2", parameterId: "P1", name: "תרגיל 2", why: "למה 2", order: 2 },
    { id: "d1", parameterId: "P1", name: "תרגיל 1", why: "למה 1", order: 1 },
    { id: "d3", parameterId: "P2", name: "תרגיל 3", why: null, order: 1 },
    { id: "d4", parameterId: "P3", name: "תרגיל 4", why: null, order: 1 },
    { id: "d5", parameterId: "P4", name: "תרגיל 5", why: null, order: 1 },
    { id: "d7", parameterId: "P6", name: "תרגיל 7", why: null, order: 1 },
    { id: "d8", parameterId: "P7", name: "תרגיל 8", why: null, order: 1 },
  ],
};

const NOTHING_DONE: ReadonlySet<string> = new Set();
const ids = (drills: readonly { id: string }[]) => drills.map((drill) => drill.id);

function candidates(overrides: Partial<Parameters<typeof drillCandidatesFor>[1]> = {}) {
  return drillCandidatesFor(POOL, {
    metrics: ["sprint_10m", "kick_power_right_foot"],
    ageGroup: "U13-14",
    position: "CB",
    doneIds: NOTHING_DONE,
    limit: 6,
    ...overrides,
  });
}

describe("drillName", () => {
  test("the Hebrew name, else the English one, trimmed", () => {
    expect(drillName("", "Box Jumps")).toBe("Box Jumps");
    expect(drillName(" קפיצות ", "x")).toBe("קפיצות");
    expect(drillName(null, " Box Jumps ")).toBe("Box Jumps");
  });

  test("no name at all is null", () => {
    expect(drillName(null, " ")).toBeNull();
    expect(drillName(null, null)).toBeNull();
  });
});

describe("drillWhy", () => {
  test("drops the book's leading label", () => {
    expect(drillWhy("למה זה עובד: בונה כוח")).toBe("בונה כוח");
    expect(drillWhy("  למה זה עובד:בונה כוח ")).toBe("בונה כוח");
  });

  test("a line without the label is kept, trimmed", () => {
    expect(drillWhy("בונה כוח")).toBe("בונה כוח");
    expect(drillWhy(" בונה כוח ")).toBe("בונה כוח");
  });

  test("nothing left is null", () => {
    expect(drillWhy("  ")).toBeNull();
    expect(drillWhy("למה זה עובד: ")).toBeNull();
    expect(drillWhy(null)).toBeNull();
  });
});

describe("fitsAge", () => {
  test.each([
    [[], "U13-14"],
    [["U15+"], "U17+"],
    [["U15+"], "U15-16"],
    [["U10-12"], null],
    [["U8"], "U13-14"],
    [["U13-14", "U15-16"], "U15-16"],
  ] as const)("%j fits %s", (rows, group) => {
    expect(fitsAge(rows, group)).toBe(true);
  });

  test.each([
    [["U10-12"], "U13-14"],
    [["U10-12", "U8"], "U13-14"],
    [["U15+"], "U13-14"],
    [["U17+"], "U15-16"],
  ] as const)("%j does not fit %s", (rows, group) => {
    expect(fitsAge(rows, group)).toBe(false);
  });
});

describe("drillsForMetric", () => {
  test("the visible parameters that fit the age, in book order, each drill once", () => {
    const drills = drillsForMetric(POOL, "sprint_10m", { ageGroup: "U13-14", position: "CB" });
    expect(ids(drills)).toEqual(["d1", "d2", "d6"]);
    expect(drills[0]).toEqual({ id: "d1", parameterId: "P1", name: "תרגיל 1", why: "למה 1", order: 1, parameterName: "פרמטר P1" });
  });

  test("a null position sees the parameter hidden from every position", () => {
    expect(ids(drillsForMetric(POOL, "sprint_10m", { ageGroup: "U13-14", position: null }))).toEqual([
      "d1",
      "d2",
      "d4",
      "d6",
    ]);
  });

  test("an unmapped metric has no drills", () => {
    expect(drillsForMetric(POOL, "envelope", { ageGroup: null, position: null })).toEqual([]);
  });

  test("a drill listed twice comes once", () => {
    const doubled: DrillPool = { ...POOL, drills: [...POOL.drills, POOL.drills[2]] };
    expect(ids(drillsForMetric(doubled, "sprint_10m", { ageGroup: "U13-14", position: "CB" }))).toEqual([
      "d1",
      "d2",
      "d6",
    ]);
  });
});

describe("drillCandidatesFor", () => {
  test("a CB at U13-14 gets no drill of a wing parameter or of the hidden one", () => {
    expect(ids(candidates())).toEqual(["d1", "d2", "d6"]);
  });

  test("one drill per metric in turn", () => {
    const drills = candidates({ position: "LW" });
    expect(ids(drills)).toEqual(["d1", "d3", "d2", "d6"]);
    expect(drills[1]).toEqual({
      id: "d3",
      name: "תרגיל 3",
      why: null,
      metricKey: "kick_power_right_foot",
      parameterName: "פרמטר P2",
    });
  });

  test("a null position includes the parameter hidden from every position", () => {
    expect(ids(candidates({ position: null }))).toContain("d4");
  });

  test("unknown age labels hide nothing", () => {
    expect(ids(candidates({ metrics: ["jump_2leg_height"] }))).toEqual(["d8"]);
  });

  test("a drill done lately is left out", () => {
    expect(ids(candidates({ doneIds: new Set(["d1"]) }))).toEqual(["d2", "d6"]);
  });

  test("a metric's preferred drills come first", () => {
    expect(ids(candidates({ preferred: new Map([["sprint_10m", ["d2"]]]) }))).toEqual(["d2", "d1", "d6"]);
  });

  test("a preferred drill that is done or not offered is not brought back", () => {
    const preferred = new Map([["sprint_10m", ["d4", "d2", "missing"]]]);
    expect(ids(candidates({ preferred, doneIds: new Set(["d2"]) }))).toEqual(["d1", "d6"]);
  });

  test("never more than the limit", () => {
    expect(ids(candidates({ position: "LW", limit: 2 }))).toEqual(["d1", "d3"]);
  });

  test("a parameter only for another age gives nothing", () => {
    expect(candidates({ metrics: ["jump_2leg_distance"] })).toEqual([]);
  });

  test("a parameter mapped to two requested metrics gives its drill once, under the first", () => {
    const shared: DrillPool = {
      ...POOL,
      parameters: POOL.parameters.map((p) => (p.id === "P1" ? { ...p, metricKeys: ["sprint_10m", "sprint_5m"] } : p)),
    };
    const drills = drillCandidatesFor(shared, {
      metrics: ["sprint_10m", "sprint_5m"],
      ageGroup: "U13-14",
      position: "CB",
      doneIds: NOTHING_DONE,
      limit: 6,
    });
    expect(ids(drills)).toEqual(["d1", "d2", "d6"]);
    expect(drills.every((drill) => drill.metricKey === "sprint_10m")).toBe(true);
  });

  test("no metrics give no drills", () => {
    expect(candidates({ metrics: [] })).toEqual([]);
  });
});

describe("metricPositionFit", () => {
  test("a parameter that names the position", () => {
    expect(metricPositionFit(POOL, "kick_power_right_foot", { ageGroup: "U13-14", position: "LW" })).toBe("position");
  });

  test("a parameter hidden from the position", () => {
    expect(metricPositionFit(POOL, "kick_power_right_foot", { ageGroup: "U13-14", position: "CB" })).toBe("none");
  });

  test("a parameter for every position", () => {
    expect(metricPositionFit(POOL, "sprint_10m", { ageGroup: "U13-14", position: "CB" })).toBe("all");
    expect(metricPositionFit(POOL, "sprint_10m", { ageGroup: "U13-14", position: null })).toBe("all");
  });

  test("an unmapped metric", () => {
    expect(metricPositionFit(POOL, "envelope", { ageGroup: "U13-14", position: "CB" })).toBe("none");
  });

  test("only parameters that fit the age count", () => {
    expect(metricPositionFit(POOL, "kick_power_left_foot", { ageGroup: "U17+", position: "LW" })).toBe("position");
    expect(metricPositionFit(POOL, "kick_power_left_foot", { ageGroup: "U13-14", position: "LW" })).toBe("none");
  });

  test("unknown age labels hide nothing", () => {
    expect(metricPositionFit(POOL, "jump_2leg_height", { ageGroup: "U13-14", position: "CB" })).toBe("all");
  });
});
