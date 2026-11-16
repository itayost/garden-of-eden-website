import { describe, expect, it } from "vitest";
import type { MetricDrill } from "@/features/development-book/lib/drill-candidates";
import type { GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import { proposalCandidates, type CandidateFacts } from "../../candidates";
import type { Gap } from "../../gaps";
import { GOAL_GUIDE } from "../guide";
import { PROPOSAL_JSON_SCHEMA } from "../output";
import { proposalInput, proposalParams } from "../request";

function gap(metric: GoalMetric, value: number, benchmark: number, fit: Gap["fit"]): Gap {
  return { metric, value, benchmark, gap: Math.abs(value - benchmark), betterThanPercent: 18, groupSize: 34, fit };
}

function drill(metricKey: string, n: number): MetricDrill {
  return {
    id: `0000000${n}-1111-4111-8111-11111111111${n}`,
    name: `תרגיל ${n}`,
    why: `3 סטים של 6 חזרות, ${n}0% מהמאמץ`,
    metricKey,
    parameterName: "האצה",
  };
}

const CANDIDATES: CandidateFacts[] = proposalCandidates({
  gaps: [gap("sprint_10m", 2.12, 1.95, "position"), gap("jump_2leg_distance", 150, 180, "all"), gap("flexibility_hip", 9, 14, "none")],
  history: new Map<PhysicalMetricKey, readonly number[]>(),
  drills: (metric) => (metric === "flexibility_hip" ? [] : [1, 2, 3].map((n) => drill(metric, n))),
});

const PLAYER = { ageGroup: "U13-14", position: "CM" };

/** Every path in a JSON value whose key is `id`, as "a.b.0.id". */
function idPaths(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value)) return value.flatMap((inner, index) => idPaths(inner, [...path, String(index)]));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => [
      ...(key === "id" ? [[...path, key].join(".")] : []),
      ...idPaths(inner, [...path, key]),
    ]);
  }
  return [];
}

describe("proposalInput", () => {
  it("holds the player's age group and position and the candidates", () => {
    const input = proposalInput(PLAYER, CANDIDATES);
    expect(input.player).toEqual({ ageGroup: "U13-14", position: "CM" });
    expect(input.candidates).toEqual(CANDIDATES);
  });

  it("keeps a missing age group or position as null", () => {
    expect(proposalInput({ ageGroup: null, position: null }, []).player).toEqual({ ageGroup: null, position: null });
  });

  it("holds no key named id outside the drills", () => {
    const text = JSON.stringify(proposalInput(PLAYER, CANDIDATES), null, 2);
    const paths = idPaths(JSON.parse(text));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path).toMatch(/^candidates\.\d+\.drills\.\d+\.id$/);
  });

  it("copies only the known fields, so an id passed along never reaches the model", () => {
    const profile = { id: "9b2f7c1e-0000-4000-8000-000000000001", fullName: "ישראל ישראלי", ...PLAYER };
    const candidate = {
      ...CANDIDATES[0],
      assessmentId: "9b2f7c1e-0000-4000-8000-000000000002",
      drills: CANDIDATES[0].drills.map((d) => ({ ...d, trainee_id: "9b2f7c1e-0000-4000-8000-000000000003" })),
    };
    const text = JSON.stringify(proposalInput(profile, [candidate]));
    expect(text).not.toContain("9b2f7c1e");
    expect(text).not.toContain("ישראל ישראלי");
    expect(proposalInput(profile, [candidate]).candidates).toEqual([CANDIDATES[0]]);
  });

  it("does not share the caller's arrays", () => {
    const input = proposalInput(PLAYER, CANDIDATES);
    expect(input.candidates).not.toBe(CANDIDATES);
    expect(input.candidates[0].drills).not.toBe(CANDIDATES[0].drills);
  });
});

describe("proposalParams", () => {
  const input = proposalInput(PLAYER, CANDIDATES);

  it("has exactly the request's keys: no sampling settings, no streaming", () => {
    const params = proposalParams(input, "claude-opus-5-5");
    expect(Object.keys(params).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system", "thinking"]);
  });

  it("adaptive thinking, medium effort and the proposal schema", () => {
    const params = proposalParams(input, "claude-sonnet-5-5");
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.max_tokens).toBe(16000);
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toEqual({
      effort: "medium",
      format: { type: "json_schema", schema: PROPOSAL_JSON_SCHEMA },
    });
  });

  it("the goal guide is the one cached system block", () => {
    expect(proposalParams(input, "claude-opus-5-5").system).toEqual([
      { type: "text", text: GOAL_GUIDE, cache_control: { type: "ephemeral" } },
    ]);
  });

  it("the only user content is the input", () => {
    expect(proposalParams(input, "claude-opus-5-5").messages).toEqual([
      { role: "user", content: `המועמדים ליעדים אחרי המבדק:\n${JSON.stringify(input, null, 2)}` },
    ]);
  });

  it("two Trainees share the same prefix up to the user message", () => {
    const other = proposalInput({ ageGroup: "U17+", position: null }, CANDIDATES.slice(1));
    const a = proposalParams(input, "claude-opus-5-5");
    const b = proposalParams(other, "claude-opus-5-5");
    expect(a.system).toEqual(b.system);
    expect(a.output_config).toEqual(b.output_config);
    expect(a.messages).not.toEqual(b.messages);
  });
});
