import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveTimestamp } from "../resolve-timestamp";

describe("resolveTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "now" to 2026-02-15T12:00:00Z
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns server time when no timestamp provided", () => {
    const result = resolveTimestamp();
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("2026-02-15T12:00:00.000Z");
    }
  });

  it("returns server time for undefined", () => {
    const result = resolveTimestamp(undefined);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("2026-02-15T12:00:00.000Z");
    }
  });

  it("returns server time for empty string", () => {
    // Empty string is falsy -> early return to server time
    const result = resolveTimestamp("");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("2026-02-15T12:00:00.000Z");
    }
  });

  it("accepts a valid recent timestamp", () => {
    const recent = "2026-02-15T11:30:00Z"; // 30 min ago
    const result = resolveTimestamp(recent);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(new Date(recent).toISOString());
    }
  });

  it("falls back to server time for invalid date string", () => {
    const result = resolveTimestamp("not-a-date");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("2026-02-15T12:00:00.000Z");
    }
  });

  it("falls back to server time for future timestamp (>1 min)", () => {
    const future = "2026-02-15T12:05:00Z"; // 5 min in future
    const result = resolveTimestamp(future);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("2026-02-15T12:00:00.000Z");
    }
  });

  it("accepts timestamp within 1 min in the future", () => {
    const nearFuture = "2026-02-15T12:00:30Z"; // 30 sec in future
    const result = resolveTimestamp(nearFuture);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(new Date(nearFuture).toISOString());
    }
  });

  it("returns error for timestamp older than 2 hours", () => {
    const old = "2026-02-15T09:00:00Z"; // 3 hours ago
    const result = resolveTimestamp(old);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("שעתיים");
    }
  });

  it("accepts timestamp exactly at 2 hour boundary", () => {
    // Exactly 2h ago = 10:00:00 -> now - parsed = 7200000 = MAX_TIMESTAMP_AGE_MS
    // The check is `>` so exactly at boundary should pass
    const exactBoundary = "2026-02-15T10:00:00.000Z";
    const result = resolveTimestamp(exactBoundary);
    expect("value" in result).toBe(true);
  });

  it("rejects timestamp just over 2 hour boundary", () => {
    const justOver = "2026-02-15T09:59:59.999Z"; // 2h + 1ms ago
    const result = resolveTimestamp(justOver);
    expect("error" in result).toBe(true);
  });

  it("accepts timestamp just under 2 hour boundary", () => {
    const justUnder = "2026-02-15T10:00:00.001Z"; // 2h - 1ms ago
    const result = resolveTimestamp(justUnder);
    expect("value" in result).toBe(true);
  });
});
