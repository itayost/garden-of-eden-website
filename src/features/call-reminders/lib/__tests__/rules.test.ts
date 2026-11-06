import { describe, it, expect } from "vitest";
import {
  CALL_REMINDER_DELAY_MS,
  CALL_REMINDER_WINDOW_MS,
  openAttemptFor,
  reminderState,
  targetKey,
  telHref,
  type AttemptRow,
  type CallTarget,
  type DocumentationRow,
} from "../rules";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_LEAD_ID = "22222222-2222-4222-8222-222222222222";
const LEAD: CallTarget = { kind: "lead", leadId: LEAD_ID };
const RETENTION: CallTarget = {
  kind: "retention",
  reportMonth: "2026-11-01",
  phone: "+972501234567",
};

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

function attempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: "a1",
    target: LEAD,
    contactName: "דני",
    startedAt: ago(CALL_REMINDER_DELAY_MS),
    dismissedAt: null,
    ...overrides,
  };
}

function doc(target: CallTarget, createdAt: string): DocumentationRow {
  return { targetKey: targetKey(target), createdAt };
}

describe("telHref", () => {
  it("dials the E.164 number for every stored phone format", () => {
    expect(telHref("972501234567")).toBe("tel:+972501234567");
    expect(telHref("050-123-4567")).toBe("tel:+972501234567");
    expect(telHref("+972501234567")).toBe("tel:+972501234567");
  });

  it("gives no link for a phone it cannot read", () => {
    expect(telHref("12")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
  });
});

describe("targetKey", () => {
  it("keys a retention customer by phone, not by month", () => {
    const otherMonth: CallTarget = { ...RETENTION, reportMonth: "2026-10-01" };
    expect(targetKey(RETENTION)).toBe("retention:+972501234567");
    expect(targetKey(otherMonth)).toBe(targetKey(RETENTION));
    expect(targetKey(LEAD)).toBe(`lead:${LEAD_ID}`);
  });
});

describe("reminderState", () => {
  it("does not remind before 10 minutes and says when it will", () => {
    const early = attempt({ startedAt: ago(CALL_REMINDER_DELAY_MS - 1000) });
    const state = reminderState([early], [], NOW);
    expect(state.due).toEqual([]);
    expect(state.nextDueAt).toBe(new Date(NOW + 1000).toISOString());
  });

  it("reminds at exactly 10 minutes", () => {
    const state = reminderState([attempt()], [], NOW);
    expect(state.due).toEqual([
      { attemptId: "a1", target: LEAD, contactName: "דני", startedAt: ago(CALL_REMINDER_DELAY_MS) },
    ]);
    expect(state.nextDueAt).toBeNull();
  });

  it("is cleared by documentation written at or after the tap", () => {
    const tap = attempt();
    expect(reminderState([tap], [doc(LEAD, tap.startedAt)], NOW).due).toEqual([]);
  });

  it("is not cleared by documentation written before the tap", () => {
    const tap = attempt();
    const before = new Date(Date.parse(tap.startedAt) - 1).toISOString();
    expect(reminderState([tap], [doc(LEAD, before)], NOW).due).toHaveLength(1);
  });

  it("is not cleared by documentation of another person", () => {
    const tap = attempt();
    const other: CallTarget = { kind: "lead", leadId: OTHER_LEAD_ID };
    expect(reminderState([tap], [doc(other, ago(0))], NOW).due).toHaveLength(1);
  });

  it("drops a dismissed attempt from both lists", () => {
    const dismissed = attempt({ dismissedAt: ago(0) });
    const pending = attempt({
      id: "a2",
      dismissedAt: ago(0),
      startedAt: ago(CALL_REMINDER_DELAY_MS - 1000),
    });
    expect(reminderState([dismissed, pending], [], NOW)).toEqual({ due: [], nextDueAt: null });
  });

  it("ignores an attempt older than 7 days", () => {
    const old = attempt({ startedAt: ago(CALL_REMINDER_WINDOW_MS + 1) });
    expect(reminderState([old], [], NOW).due).toEqual([]);
  });

  it("shows one reminder per person, from the earliest tap", () => {
    const first = attempt({ id: "first", startedAt: ago(CALL_REMINDER_DELAY_MS + 60_000) });
    const second = attempt({ id: "second" });
    const state = reminderState([second, first], [], NOW);
    expect(state.due.map((r) => r.attemptId)).toEqual(["first"]);
  });

  it("lists the oldest first and points at the earliest future reminder", () => {
    const leadTap = attempt({ id: "lead", startedAt: ago(CALL_REMINDER_DELAY_MS) });
    const retentionTap = attempt({
      id: "retention",
      target: RETENTION,
      startedAt: ago(CALL_REMINDER_DELAY_MS + 120_000),
    });
    const laterA = attempt({
      id: "later-a",
      target: { kind: "lead", leadId: OTHER_LEAD_ID },
      startedAt: ago(60_000),
    });
    const laterB = attempt({
      id: "later-b",
      target: { ...RETENTION, phone: "+972521111111" },
      startedAt: ago(120_000),
    });
    const state = reminderState([leadTap, laterA, retentionTap, laterB], [], NOW);
    expect(state.due.map((r) => r.attemptId)).toEqual(["retention", "lead"]);
    expect(state.nextDueAt).toBe(
      new Date(NOW - 120_000 + CALL_REMINDER_DELAY_MS).toISOString(),
    );
  });
});

describe("openAttemptFor", () => {
  it("returns the earliest open attempt for the person", () => {
    const first = attempt({ id: "first", startedAt: ago(120_000) });
    const second = attempt({ id: "second", startedAt: ago(60_000) });
    expect(openAttemptFor([second, first], [], LEAD, NOW)?.id).toBe("first");
  });

  it("returns null once the call is documented", () => {
    const tap = attempt({ startedAt: ago(60_000) });
    expect(openAttemptFor([tap], [doc(LEAD, ago(0))], LEAD, NOW)).toBeNull();
  });

  it("returns null for a dismissed, expired or other person's attempt", () => {
    const dismissed = attempt({ dismissedAt: ago(0) });
    const expired = attempt({ id: "old", startedAt: ago(CALL_REMINDER_WINDOW_MS + 1) });
    const other = attempt({ id: "other", target: RETENTION });
    expect(openAttemptFor([dismissed, expired, other], [], LEAD, NOW)).toBeNull();
  });
});
