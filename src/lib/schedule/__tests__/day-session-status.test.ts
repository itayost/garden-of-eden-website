import { describe, expect, test } from "vitest";

import { toDaySessionStatuses, type SessionStatusRow } from "@/lib/schedule/day-session-status";

const row = (over: Partial<SessionStatusRow> = {}): SessionStatusRow => ({
  trainee_id: "t1",
  session_date: "2026-09-18",
  slot_id: "slot-1",
  completed_at: null,
  exercises: [{ id: "e1" }, { id: "e2" }],
  ...over,
});

describe("toDaySessionStatuses", () => {
  test("groups by date, then slot, then trainee", () => {
    const statuses = toDaySessionStatuses([
      row({ trainee_id: "a", session_date: "2026-09-18" }),
      row({ trainee_id: "b", session_date: "2026-09-19" }),
    ]);

    expect(Object.keys(statuses)).toEqual(["2026-09-18", "2026-09-19"]);
    expect(statuses["2026-09-18"]["slot-1"].a.status).toBe("built");
    expect(statuses["2026-09-19"]["slot-1"].b.status).toBe("built");
  });

  test("counts the exercises of a built session", () => {
    const statuses = toDaySessionStatuses([row({ exercises: [{ id: "1" }, { id: "2" }, { id: "3" }] })]);

    expect(statuses["2026-09-18"]["slot-1"].t1.exerciseCount).toBe(3);
  });

  test("marks a session with a completion time as completed", () => {
    const statuses = toDaySessionStatuses([row({ completed_at: "2026-09-18T15:00:00Z" })]);

    expect(statuses["2026-09-18"]["slot-1"].t1.status).toBe("completed");
  });

  test("a session built with no exercises still counts as built", () => {
    const statuses = toDaySessionStatuses([row({ exercises: [] })]);

    expect(statuses["2026-09-18"]["slot-1"].t1).toEqual({ status: "built", exerciseCount: 0 });
  });

  test("treats a missing exercises embed as no exercises", () => {
    const statuses = toDaySessionStatuses([row({ exercises: null })]);

    expect(statuses["2026-09-18"]["slot-1"].t1.exerciseCount).toBe(0);
  });

  test("keeps both trainees when they share a day", () => {
    const statuses = toDaySessionStatuses([
      row({ trainee_id: "a" }),
      row({ trainee_id: "b", completed_at: "2026-09-18T15:00:00Z" }),
    ]);

    expect(statuses["2026-09-18"]["slot-1"].a.status).toBe("built");
    expect(statuses["2026-09-18"]["slot-1"].b.status).toBe("completed");
  });

  test("keeps a trainee's two hours apart on one day", () => {
    const statuses = toDaySessionStatuses([
      row({ slot_id: "slot-a" }),
      row({ slot_id: "slot-b", completed_at: "2026-09-18T19:00:00Z" }),
    ]);

    expect(statuses["2026-09-18"]["slot-a"].t1.status).toBe("built");
    expect(statuses["2026-09-18"]["slot-b"].t1.status).toBe("completed");
  });

  test("a session with no slot lands under the empty key", () => {
    const statuses = toDaySessionStatuses([row({ slot_id: null, exercises: [] })]);

    expect(statuses["2026-09-18"][""].t1.exerciseCount).toBe(0);
  });

  test("returns an empty map for no rows", () => {
    expect(toDaySessionStatuses([])).toEqual({});
  });
});
