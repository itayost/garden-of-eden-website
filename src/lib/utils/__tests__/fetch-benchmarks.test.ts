import { describe, it, expect } from "vitest";
import { benchmarkRowToGroupStats } from "../fetch-benchmarks";
import { NUMERIC_METRIC_KEYS } from "../assessment-metrics";

function row(overrides: Record<string, string | number | null> = {}) {
  const base: Record<string, string | number | null> = { age_group: "u12", player_count: 30 };
  for (const key of NUMERIC_METRIC_KEYS) {
    base[`${key}_best`] = null;
    base[`${key}_worst`] = null;
  }
  return { ...base, ...overrides } as { age_group: string; player_count: number } & Record<
    string,
    string | number | null
  >;
}

describe("benchmarkRowToGroupStats", () => {
  it("returns null when fewer than 2 trainees are in the age group", () => {
    expect(benchmarkRowToGroupStats(row({ player_count: 1 }))).toBeNull();
  });

  it("reads each test's best and worst, with -1 for no data", () => {
    const stats = benchmarkRowToGroupStats(row({ sprint_10m_best: "1.8", sprint_10m_worst: 2.4 }))!;
    expect(stats.sprint_10m).toEqual({ best: 1.8, worst: 2.4 });
    expect(stats.sprint_5m).toEqual({ best: -1, worst: -1 });
  });

  it("carries how many trainees have each envelope test", () => {
    const stats = benchmarkRowToGroupStats(
      row({
        envelope_best: 15, envelope_worst: 25, envelope_players: 7,
        envelope_ball_best: 18, envelope_ball_worst: 30, envelope_ball_players: 3,
      }),
    )!;
    expect(stats.envelope).toEqual({ best: 15, worst: 25, players: 7 });
    expect(stats.envelope_ball).toEqual({ best: 18, worst: 30, players: 3 });
  });

  it("treats a missing envelope count as no trainees", () => {
    const stats = benchmarkRowToGroupStats(row({ envelope_best: 15, envelope_worst: 25 }))!;
    expect(stats.envelope.players).toBe(0);
  });

  it("gives the older tests no count", () => {
    const stats = benchmarkRowToGroupStats(row())!;
    expect(stats.shuffle_10m).not.toHaveProperty("players");
  });
});
