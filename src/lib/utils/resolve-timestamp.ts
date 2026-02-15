const MAX_TIMESTAMP_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Validate and resolve a client-provided timestamp.
 * Returns a valid ISO string, or falls back to server time.
 * Rejects timestamps older than 2 hours.
 */
export function resolveTimestamp(
  clientTimestamp?: string
): { value: string } | { error: string } {
  if (!clientTimestamp) {
    return { value: new Date().toISOString() };
  }

  const parsed = new Date(clientTimestamp);
  if (isNaN(parsed.getTime())) {
    return { value: new Date().toISOString() };
  }

  const now = Date.now();

  // Reject future timestamps — use server time instead
  if (parsed.getTime() > now + 60_000) {
    return { value: new Date().toISOString() };
  }

  // Reject timestamps older than 2 hours
  if (now - parsed.getTime() > MAX_TIMESTAMP_AGE_MS) {
    return { error: "חלפו יותר משעתיים מאז הפעולה - נא לבצע שוב" };
  }

  return { value: parsed.toISOString() };
}
