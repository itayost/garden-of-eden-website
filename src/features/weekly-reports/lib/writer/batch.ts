/**
 * The Friday 01:00 Message Batches request: one request per report, keyed by
 * the report row's id, collected from 07:30. A batch request cannot set
 * `fallbacks`; whatever the batch did not write, the direct pass writes.
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { FactSheet } from "../fact-sheet/types";
import { apiFailure } from "./client";
import { replyOutcome, type WriteOutcome, type WriterReply } from "./output";
import { writerParams, type WriterModel } from "./request";

/** Sends one batch for these rows and returns its id. Throws without the request on failure. */
export async function submitBatch(
  client: Anthropic,
  items: readonly { id: string; sheet: FactSheet }[],
  model: WriterModel,
): Promise<string> {
  if (items.length === 0) throw new Error("Weekly reports: a batch needs at least one report");
  try {
    const batch = await client.messages.batches.create({
      requests: items.map(({ id, sheet }) => ({ custom_id: id, params: writerParams(sheet, model) })),
    });
    return batch.id;
  } catch (error) {
    throw apiFailure("batch submit", error);
  }
}

function replyOf(message: Anthropic.Message): WriterReply {
  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  return { stopReason: message.stop_reason, text: text?.text ?? null, usage: message.usage, model: message.model };
}

function outcomeOf(result: Anthropic.Messages.MessageBatchResult): WriteOutcome {
  switch (result.type) {
    case "succeeded":
      return replyOutcome(replyOf(result.message));
    case "errored":
      return { ok: false, reason: `errored: ${result.error.error.type}` };
    case "canceled":
      return { ok: false, reason: "canceled" };
    case "expired":
      return { ok: false, reason: "expired" };
  }
}

/**
 * The batch's outcomes by report id once it has ended; `ended: false` and no
 * outcomes while it is still running. Throws without the request on failure.
 */
export async function collectBatch(
  client: Anthropic,
  batchId: string,
): Promise<{ ended: boolean; results: Map<string, WriteOutcome> }> {
  try {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status !== "ended") return { ended: false, results: new Map() };
    const results = new Map<string, WriteOutcome>();
    for await (const item of await client.messages.batches.results(batchId)) {
      results.set(item.custom_id, outcomeOf(item.result));
    }
    return { ended: true, results };
  } catch (error) {
    throw apiFailure("batch collect", error);
  }
}

/**
 * Stops a batch that is still running, so it bills no more; the requests that
 * finished stay collectable. Never throws: a failed cancel is logged and the
 * direct pass goes on.
 */
export async function cancelBatch(client: Anthropic, batchId: string): Promise<boolean> {
  try {
    await client.messages.batches.cancel(batchId);
    return true;
  } catch (error) {
    apiFailure("batch cancel", error);
    return false;
  }
}
