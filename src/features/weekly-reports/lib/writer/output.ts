/**
 * The writer's structured output: the JSON schema sent to the model, the Zod
 * schema of the same shape, and the parser that reads a reply. Pure.
 *
 * Counts and lengths (at most 3 drills, about 110 and 140 words) are the
 * guardrails' job, not the schema's: a reply that breaks them is held for a
 * person, not thrown away.
 */
import { z } from "zod";

export interface WriterOutput {
  player_text: string;
  parent_text: string;
  drill_ids: string[];
}

/** The `output_config.format.schema` of every writer request. */
export const WRITER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["player_text", "parent_text", "drill_ids"],
  properties: {
    player_text: { type: "string" },
    parent_text: { type: "string" },
    drill_ids: { type: "array", items: { type: "string" } },
  },
} as const satisfies Record<string, unknown>;

/** The same shape as WRITER_JSON_SCHEMA; an extra field is refused. */
export const writerOutputSchema = z.strictObject({
  player_text: z.string(),
  parent_text: z.string(),
  drill_ids: z.array(z.string()),
});

/** The reply's text as a WriterOutput, or null when it is not one. */
export function parseWriterOutput(text: string): WriterOutput | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = writerOutputSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * One request's result: the texts with the model that wrote them and the
 * token usage, or why there are none (`errored`, `canceled`, `expired`,
 * `refusal`, `max_tokens`, `unparsable`, an API error...). The reason is for
 * the logs; staff see "הכתיבה נכשלה".
 */
export type WriteOutcome =
  | { ok: true; output: WriterOutput; usage: unknown; model: string }
  | { ok: false; reason: string };

/** What the batch and the direct request read off a reply before deciding. */
export interface WriterReply {
  stopReason: string | null;
  /** The answer's text block, null when there is none. */
  text: string | null;
  usage: unknown;
  model: string;
}

/** Stop reasons of a reply that ran to its end; anything else was cut short or declined. */
const FINISHED = ["end_turn", "stop_sequence"];

/**
 * The text of a reply that ran to its end. The stop reason is checked before
 * the text: a refusal (the whole fallback chain declined) or a reply cut short
 * is never read, even when its text happens to parse. Shared with the Goal
 * proposal writer, which reads its own output from the same kind of reply.
 */
export function finishedText(reply: WriterReply): { ok: true; text: string } | { ok: false; reason: string } {
  if (reply.stopReason === null || !FINISHED.includes(reply.stopReason)) {
    return { ok: false, reason: reply.stopReason ?? "no_stop_reason" };
  }
  if (reply.text === null) return { ok: false, reason: "unparsable" };
  return { ok: true, text: reply.text };
}

/** The outcome of a reply: its finished text (finishedText) parsed as the writer's output. */
export function replyOutcome(reply: WriterReply): WriteOutcome {
  const finished = finishedText(reply);
  if (!finished.ok) return finished;
  const output = parseWriterOutput(finished.text);
  if (output === null) return { ok: false, reason: "unparsable" };
  return { ok: true, output, usage: reply.usage, model: reply.model };
}
