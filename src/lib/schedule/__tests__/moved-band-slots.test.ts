import { describe, expect, test } from "vitest";

import { partitionMovedBandSlots } from "../moved-band-slots";

const slot = (id: string, hasWorkout = false) => ({ id, hasWorkout });
const row = (slot_id: string, cancelled_at: string | null = null, late_cancel = false) => ({
  slot_id,
  cancelled_at,
  late_cancel,
});

describe("partitionMovedBandSlots", () => {
  test("deletes empty days and keeps days someone is on", () => {
    const result = partitionMovedBandSlots([slot("a"), slot("b"), slot("c")], [row("b")]);

    expect(result).toEqual({ deleteIds: ["a", "c"], detachIds: ["b"] });
  });

  test("a late cancel still counts and keeps the day", () => {
    // It already cost the trainee a session; the day is their record.
    const result = partitionMovedBandSlots([slot("a")], [row("a", "2026-09-27T10:00:00Z", true)]);

    expect(result).toEqual({ deleteIds: [], detachIds: ["a"] });
  });

  test("a plain cancel does not keep the day", () => {
    const result = partitionMovedBandSlots([slot("a")], [row("a", "2026-09-27T10:00:00Z", false)]);

    expect(result).toEqual({ deleteIds: ["a"], detachIds: [] });
  });

  test("a day with a group workout written is kept even with nobody on it", () => {
    const result = partitionMovedBandSlots([slot("a", true)], []);

    expect(result).toEqual({ deleteIds: [], detachIds: ["a"] });
  });

  test("returns nothing for no days", () => {
    expect(partitionMovedBandSlots([], [])).toEqual({ deleteIds: [], detachIds: [] });
  });
});
