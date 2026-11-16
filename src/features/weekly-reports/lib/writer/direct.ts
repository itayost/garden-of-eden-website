/**
 * One report written with a direct request, for whatever the batch did not
 * write by 07:30. Unlike a batch request it opts into server-side fallbacks:
 * when the model declines, the API reruns the request on the model's default
 * fallback inside the same call. The Goal proposal writer sends its requests
 * through the same directReply().
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { FactSheet } from "../fact-sheet/types";
import { apiFailure } from "./client";
import { replyOutcome, type WriteOutcome, type WriterReply } from "./output";
import { writerParams, type WriterModel } from "./request";

/** The beta that lets a direct request fall back to the model's default fallback. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * The answer's text: the first text block after the last fallback switch, so
 * a declined model's partial text is never read as the answer.
 */
function replyOf(message: Anthropic.Beta.Messages.BetaMessage): WriterReply {
  const lastSwitch = message.content.findLastIndex((block) => block.type === "fallback");
  const text = message.content
    .slice(lastSwitch + 1)
    .find((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === "text");
  return { stopReason: message.stop_reason, text: text?.text ?? null, usage: message.usage, model: message.model };
}

/**
 * Sends one request with server-side fallbacks and reads its reply. Throws on
 * an API error; the caller logs it through apiFailure().
 */
export async function directReply(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<WriterReply> {
  const message = await client.beta.messages.create({
    ...params,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  });
  return replyOf(message);
}

/**
 * Writes one report. A refusal of the whole fallback chain, a reply cut
 * short, an unparsable reply or a failed call give `{ ok: false, reason }`;
 * the failure is logged with its status and type, never with the request.
 */
export async function writeDirect(client: Anthropic, sheet: FactSheet, model: WriterModel): Promise<WriteOutcome> {
  try {
    return replyOutcome(await directReply(client, writerParams(sheet, model)));
  } catch (error) {
    return { ok: false, reason: apiFailure("direct write", error).message };
  }
}
