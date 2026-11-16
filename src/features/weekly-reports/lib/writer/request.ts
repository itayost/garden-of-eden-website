/**
 * The one request the writer sends per report, for the batch and the direct
 * pass alike. Pure but for reading WEEKLY_REPORT_MODEL.
 *
 * The style guide is the same in every request, so it is the cached prefix;
 * the Fact sheet is the only thing that changes. Thinking is adaptive and the
 * effort is set explicitly: a disabled thinking or a token budget is refused
 * on these models, and the default effort differs between them.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { FactSheet } from "../fact-sheet/types";
import { WRITER_JSON_SCHEMA } from "./output";
import { STYLE_GUIDE } from "./style-guide";

/** The models the blind comparison chooses between. */
export const WRITER_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const;

export type WriterModel = (typeof WRITER_MODELS)[number];

export const DEFAULT_WRITER_MODEL: WriterModel = "claude-opus-5-5";

/** Room for the thinking and two short texts; well inside a non-streaming request. */
const MAX_TOKENS = 16000;

function isWriterModel(value: string): value is WriterModel {
  return WRITER_MODELS.some((model) => model === value);
}

/** WEEKLY_REPORT_MODEL when it names one of WRITER_MODELS, else Opus 5.5. */
export function writerModel(): WriterModel {
  const configured = (process.env.WEEKLY_REPORT_MODEL ?? "").trim();
  return isWriterModel(configured) ? configured : DEFAULT_WRITER_MODEL;
}

export function writerParams(sheet: FactSheet, model: WriterModel): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `דף העובדות של השבוע:\n${JSON.stringify(sheet, null, 2)}` }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: WRITER_JSON_SCHEMA } },
  };
}
