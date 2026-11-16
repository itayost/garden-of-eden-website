/**
 * The Anthropic client of the weekly report writer. No ANTHROPIC_API_KEY, no
 * client, and no reports: the write job logs and stops.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";

export interface ClientLimits {
  timeoutMs: number;
  maxRetries: number;
}

/**
 * A direct request must not hold the write route past its 300 seconds: two
 * minutes a try and one retry, while the job starts no new request after its
 * deadline.
 */
export const JOB_LIMITS: ClientLimits = { timeoutMs: 120_000, maxRetries: 1 };

/**
 * כתוב מחדש and בן / בת run inside the queue page's 120 seconds, after a few
 * reads: one try that gives up in time for the action to answer.
 */
export const QUEUE_LIMITS: ClientLimits = { timeoutMs: 90_000, maxRetries: 0 };

export function anthropicClient(limits: ClientLimits = JOB_LIMITS): Anthropic | null {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (apiKey === "") return null;
  return new Anthropic({ apiKey, timeout: limits.timeoutMs, maxRetries: limits.maxRetries });
}

/**
 * A failed API call as a log line and an Error naming only the HTTP status and
 * the error type: never the request, which holds a Fact sheet.
 */
export function apiFailure(what: string, error: unknown): Error {
  if (error instanceof Anthropic.APIError) {
    console.error(`[weekly-reports] ${what} failed:`, error.status ?? "no status", error.type ?? "no type");
    return new Error(`Weekly reports: ${what} failed (${error.status ?? "no status"} ${error.type ?? "no type"})`);
  }
  const name = error instanceof Error ? error.name : typeof error;
  console.error(`[weekly-reports] ${what} failed:`, name);
  return new Error(`Weekly reports: ${what} failed (${name})`);
}
