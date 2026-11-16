import { describe, expect, it } from "vitest";
import { GOAL_METRICS } from "@/features/goals/lib/config/goal-config";
import {
  parseProposalOutput,
  PROPOSAL_JSON_SCHEMA,
  proposalOutcome,
  proposalOutputSchema,
} from "../output";

const VALID = {
  picks: [
    {
      metric_key: "sprint_10m",
      reason: "הפער לרף הקבוצה בספרינט 10 מטר הוא הגדול ביותר, וזה מדד שמשתפר מהר באימון.",
      drill_ids: ["11111111-1111-4111-8111-111111111111"],
    },
    { metric_key: "flexibility_hip", reason: "גמישות אגן נמוכה מהקבוצה.", drill_ids: [] },
  ],
};

describe("parseProposalOutput", () => {
  it("accepts a valid answer", () => {
    expect(parseProposalOutput(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("accepts an answer that picks nothing", () => {
    expect(parseProposalOutput(JSON.stringify({ picks: [] }))).toEqual({ picks: [] });
  });

  it("refuses text that is not JSON", () => {
    expect(parseProposalOutput("{ picks: ")).toBeNull();
    expect(parseProposalOutput("")).toBeNull();
  });

  it("refuses JSON that is not an object", () => {
    expect(parseProposalOutput("null")).toBeNull();
    expect(parseProposalOutput("[]")).toBeNull();
  });

  it("refuses a missing picks", () => {
    expect(parseProposalOutput(JSON.stringify({}))).toBeNull();
  });

  it("refuses an extra field, at the top or in a pick", () => {
    expect(parseProposalOutput(JSON.stringify({ ...VALID, note: "x" }))).toBeNull();
    const extraInPick = { picks: [{ ...VALID.picks[0], target: 1.9 }] };
    expect(parseProposalOutput(JSON.stringify(extraInPick))).toBeNull();
  });

  it("refuses a pick without reason", () => {
    const withoutReason = { picks: [{ metric_key: "sprint_10m", drill_ids: [] }] };
    expect(parseProposalOutput(JSON.stringify(withoutReason))).toBeNull();
  });

  it("refuses a field of the wrong type", () => {
    expect(parseProposalOutput(JSON.stringify({ picks: [{ ...VALID.picks[0], drill_ids: [1] }] }))).toBeNull();
    expect(parseProposalOutput(JSON.stringify({ picks: "sprint_10m" }))).toBeNull();
  });

  it("leaves an unoffered metric key to the guardrails", () => {
    const unknown = { picks: [{ ...VALID.picks[0], metric_key: "kick_power_kaiser" }] };
    expect(parseProposalOutput(JSON.stringify(unknown))).toEqual(unknown);
  });
});

describe("PROPOSAL_JSON_SCHEMA", () => {
  it("is a closed object holding only picks", () => {
    expect(PROPOSAL_JSON_SCHEMA.type).toBe("object");
    expect(PROPOSAL_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...PROPOSAL_JSON_SCHEMA.required]).toEqual(["picks"]);
    expect(Object.keys(PROPOSAL_JSON_SCHEMA.properties)).toEqual(["picks"]);
  });

  it("closes each pick on the three fields", () => {
    const pick = PROPOSAL_JSON_SCHEMA.properties.picks.items;
    expect(PROPOSAL_JSON_SCHEMA.properties.picks.type).toBe("array");
    expect(pick.additionalProperties).toBe(false);
    expect([...pick.required].sort()).toEqual(["drill_ids", "metric_key", "reason"]);
    expect(pick.properties.reason).toEqual({ type: "string" });
    expect(pick.properties.drill_ids).toEqual({ type: "array", items: { type: "string" } });
  });

  it("lets metric_key be only one of the 18 Goal metrics", () => {
    const metricKey = PROPOSAL_JSON_SCHEMA.properties.picks.items.properties.metric_key;
    expect(metricKey.type).toBe("string");
    expect([...metricKey.enum]).toEqual([...GOAL_METRICS]);
    expect(metricKey.enum).toHaveLength(18);
    expect(metricKey.enum).not.toContain("kick_power_kaiser");
  });

  it("holds no string length or array count, which structured outputs refuse", () => {
    const text = JSON.stringify(PROPOSAL_JSON_SCHEMA);
    expect(text).not.toMatch(/maxLength|minLength|maxItems|minItems/);
  });

  it("names the same fields as the Zod schema", () => {
    expect(Object.keys(PROPOSAL_JSON_SCHEMA.properties).sort()).toEqual(Object.keys(proposalOutputSchema.shape).sort());
    const pickShape = proposalOutputSchema.shape.picks.element.shape;
    const pick = PROPOSAL_JSON_SCHEMA.properties.picks.items;
    expect(Object.keys(pick.properties).sort()).toEqual(Object.keys(pickShape).sort());
    expect([...pick.required].sort()).toEqual(Object.keys(pickShape).sort());
  });
});

describe("proposalOutcome", () => {
  const usage = { input_tokens: 10, output_tokens: 20 };
  const reply = (stopReason: string | null, text: string | null) => ({
    stopReason,
    text,
    usage,
    model: "claude-opus-5-5",
  });

  it("a finished reply with a valid answer is ok", () => {
    expect(proposalOutcome(reply("end_turn", JSON.stringify(VALID)))).toEqual({
      ok: true,
      output: VALID,
      usage,
      model: "claude-opus-5-5",
    });
  });

  it("a refusal is not ok, even when its text parses", () => {
    expect(proposalOutcome(reply("refusal", JSON.stringify(VALID)))).toEqual({ ok: false, reason: "refusal" });
  });

  it("a reply cut short is not ok, even when its text parses", () => {
    expect(proposalOutcome(reply("max_tokens", JSON.stringify(VALID)))).toEqual({ ok: false, reason: "max_tokens" });
  });

  it("no stop reason is not ok", () => {
    expect(proposalOutcome(reply(null, JSON.stringify(VALID)))).toEqual({ ok: false, reason: "no_stop_reason" });
  });

  it("no text, or text that is not the answer, is unparsable", () => {
    expect(proposalOutcome(reply("end_turn", null))).toEqual({ ok: false, reason: "unparsable" });
    expect(proposalOutcome(reply("end_turn", "שלום"))).toEqual({ ok: false, reason: "unparsable" });
  });
});
