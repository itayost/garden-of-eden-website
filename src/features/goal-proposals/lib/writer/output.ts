/**
 * The Goal proposal writer's structured output: the JSON schema sent to the
 * model, the Zod schema of the same shape, and the parser that reads a
 * reply. Pure.
 *
 * The schema is the same in every request, so it is compiled once. It holds
 * no string length or array count, which structured outputs refuse: at most 3
 * picks, at most 3 drills, a reason of one line and the metric being one of
 * the offered candidates are the guardrails' job (guardrails.ts). For the same
 * reason the Zod schema reads `metric_key` as any string: an unoffered metric
 * drops that one pick, never the whole answer.
 */
import { z } from "zod";
import { GOAL_METRICS } from "@/features/goals/lib/config/goal-config";
import { finishedText, type WriterReply } from "@/features/weekly-reports/lib/writer/output";

export interface ProposalPick {
  metric_key: string;
  reason: string;
  drill_ids: string[];
}

export interface ProposalOutput {
  picks: ProposalPick[];
}

/** The `output_config.format.schema` of every proposal request. */
export const PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric_key", "reason", "drill_ids"],
        properties: {
          metric_key: { type: "string", enum: [...GOAL_METRICS] },
          reason: { type: "string" },
          drill_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

/** The same shape as PROPOSAL_JSON_SCHEMA; an extra field is refused. */
export const proposalOutputSchema = z.strictObject({
  picks: z.array(
    z.strictObject({
      metric_key: z.string(),
      reason: z.string(),
      drill_ids: z.array(z.string()),
    }),
  ),
});

/** The reply's text as a ProposalOutput, or null when it is not one. */
export function parseProposalOutput(text: string): ProposalOutput | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = proposalOutputSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * One request's result: the picks with the model that made them and the
 * token usage, or why there are none (`refusal`, `max_tokens`, `unparsable`,
 * an API error...). The reason is for the logs; the check stays unfinished
 * and a later night tries again.
 */
export type ProposalOutcome =
  | { ok: true; output: ProposalOutput; usage: unknown; model: string }
  | { ok: false; reason: string };

/**
 * The outcome of a reply. A refusal or a reply cut short is never read, even
 * when its text happens to parse (finishedText).
 */
export function proposalOutcome(reply: WriterReply): ProposalOutcome {
  const finished = finishedText(reply);
  if (!finished.ok) return finished;
  const output = parseProposalOutput(finished.text);
  if (output === null) return { ok: false, reason: "unparsable" };
  return { ok: true, output, usage: reply.usage, model: reply.model };
}
