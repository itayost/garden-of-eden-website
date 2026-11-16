import { describe, expect, it } from "vitest";
import type { HoldReason } from "@/features/weekly-reports/lib/fact-sheet/types";
import type { CandidateFacts } from "../candidates";
import { checkPicks } from "../guardrails";
import { stepAfterModel, stepBeforeModel } from "../step";
import type { ProposalOutcome, ProposalPick } from "../writer/output";

const D = (n: number) => `0000000${n}-2222-4222-8222-22222222222${n}`;

function candidate(metricKey: CandidateFacts["metric_key"], overrides: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    metric_key: metricKey,
    metric: "ספרינט 10 מטר",
    unit: "שניות",
    direction: "נמוך יותר טוב יותר",
    value: 2.12,
    benchmark: 1.92,
    betterThanPercent: 18,
    groupSize: 34,
    step: 0.1,
    target: 2.02,
    basis: "חצי מהפער לרף הקבוצה",
    positionFit: "מתאים לעמדה",
    drills: [1, 2].map((n) => ({ id: D(n), name: `תרגיל ${n}`, why: null, parameter: "האצה" })),
    ...overrides,
  };
}

const SPRINT = candidate("sprint_10m");
const JUMP = candidate("jump_2leg_distance", {
  metric: "קפיצה למרחק בשתי רגליים",
  unit: 'ס"מ',
  direction: "גבוה יותר טוב יותר",
  value: 150,
  benchmark: 180,
  step: 15,
  target: 165,
  drills: [],
});
const CANDIDATES = [SPRINT, JUMP];

const REASON = "הפער לרף הקבוצה כאן הוא הגדול ביותר, והמדד משתפר מהר באימון.";

function pick(metricKey: string, reason = REASON, drillIds: string[] = []): ProposalPick {
  return { metric_key: metricKey, reason, drill_ids: drillIds };
}

function answered(picks: ProposalPick[]): ProposalOutcome {
  return { ok: true, output: { picks }, usage: { input_tokens: 900, output_tokens: 120 }, model: "claude-opus-5-5" };
}

const SENSITIVE: HoldReason = { code: "sensitive", text: "תגית: כאב או פציעה" };

describe("stepBeforeModel", () => {
  it("finishes an Assessment that already has proposals as proposed, without asking again", () => {
    expect(stepBeforeModel({ savedProposals: 2, candidates: 3 })).toEqual({ kind: "finish", outcome: "proposed" });
  });

  it("finishes as proposed even when there are no candidates now", () => {
    expect(stepBeforeModel({ savedProposals: 1, candidates: 0 })).toEqual({ kind: "finish", outcome: "proposed" });
  });

  it("finishes with no candidates as no_candidates", () => {
    expect(stepBeforeModel({ savedProposals: 0, candidates: 0 })).toEqual({ kind: "finish", outcome: "no_candidates" });
  });

  it("asks the model when there are candidates and nothing saved", () => {
    expect(stepBeforeModel({ savedProposals: 0, candidates: 2 })).toEqual({ kind: "ask" });
  });
});

describe("stepAfterModel", () => {
  it("retries an outcome that is not ok, with its reason", () => {
    expect(stepAfterModel({ ok: false, reason: "refusal" }, CANDIDATES, [])).toEqual({
      kind: "retry",
      reason: "refusal",
    });
  });

  it("finishes as none_picked when every pick is a metric that was not offered", () => {
    const step = stepAfterModel(answered([pick("sprint_20m"), pick("shuffle_10m")]), CANDIDATES, [SENSITIVE]);
    expect(step).toEqual({
      kind: "finish",
      outcome: "none_picked",
      dropped: ["sprint_20m: not offered", "shuffle_10m: not offered"],
    });
  });

  it("finishes as none_picked when the model picked nothing", () => {
    expect(stepAfterModel(answered([]), CANDIDATES, [])).toEqual({ kind: "finish", outcome: "none_picked", dropped: [] });
  });

  it("saves the kept picks with ranks from 1, keeping the candidate's own value and target", () => {
    const step = stepAfterModel(
      answered([pick("sprint_20m"), pick("jump_2leg_distance"), pick("sprint_10m", REASON, [D(2)])]),
      CANDIDATES,
      [],
    );
    if (step.kind !== "save") throw new Error(`expected save, got ${step.kind}`);
    expect(step.dropped).toEqual(["sprint_20m: not offered"]);
    expect(step.picks.map((p) => [p.rank, p.candidate.metric_key])).toEqual([
      [1, "jump_2leg_distance"],
      [2, "sprint_10m"],
    ]);
    expect(step.picks.map((p) => [p.candidate.value, p.candidate.target])).toEqual([
      [150, 165],
      [2.12, 2.02],
    ]);
    expect(step.picks[1].drillIds).toEqual([D(2)]);
  });

  it("with no sensitive Hold, each pick's problems are checkPicks' own", () => {
    const output = { picks: [pick("sprint_10m", "שיפור של 12 שניות", [D(9)]), pick("jump_2leg_distance")] };
    const step = stepAfterModel({ ok: true, output, usage: null, model: "claude-opus-5-5" }, CANDIDATES, []);
    if (step.kind !== "save") throw new Error(`expected save, got ${step.kind}`);
    const own = checkPicks(CANDIDATES, output).picks;
    expect(step.picks.map((p) => p.problems)).toEqual(own.map((p) => p.problems));
    expect(step.picks[0].problems.length).toBeGreaterThan(0);
    expect(step.picks[1].problems).toEqual([]);
  });

  it("puts the Trainee's sensitive Holds first in every pick's problems", () => {
    const output = { picks: [pick("sprint_10m", "שיפור של 12 שניות"), pick("jump_2leg_distance")] };
    const step = stepAfterModel({ ok: true, output, usage: null, model: "claude-opus-5-5" }, CANDIDATES, [SENSITIVE]);
    if (step.kind !== "save") throw new Error(`expected save, got ${step.kind}`);
    const own = checkPicks(CANDIDATES, output).picks;
    expect(step.picks[0].problems).toEqual([SENSITIVE, ...own[0].problems]);
    expect(step.picks[1].problems).toEqual([SENSITIVE]);
    expect(step.picks[0].reason).toBeNull();
    expect(step.picks[1].reason).toBe(REASON);
  });

  it("does not change the sensitive list it was given", () => {
    const sensitive: readonly HoldReason[] = Object.freeze([SENSITIVE]);
    stepAfterModel(answered([pick("sprint_10m"), pick("jump_2leg_distance")]), CANDIDATES, sensitive);
    expect(sensitive).toEqual([SENSITIVE]);
  });
});
