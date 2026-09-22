import { describe, expect, test } from "vitest";

import {
  countFanout,
  describeFanout,
  planSlotWorkoutFanout,
  type ExistingSession,
} from "../slot-workout-fanout";

const SLOT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_SLOT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOAM = "11111111-1111-4111-8111-111111111111";
const OMER = "22222222-2222-4222-8222-222222222222";

const candidates = [
  { traineeId: NOAM, traineeName: "נועם" },
  { traineeId: OMER, traineeName: "עומר" },
];

function session(overrides: Partial<ExistingSession> = {}): ExistingSession {
  return {
    slotId: SLOT,
    slotWorkoutSyncedAt: "2026-09-22T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("planSlotWorkoutFanout", () => {
  test("creates a session for a trainee with nothing that day", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {});
    expect(decisions.map((d) => d.action)).toEqual(["create", "create"]);
  });

  test("refreshes a session this slot already wrote", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, { [NOAM]: session() });
    expect(decisions[0].action).toBe("refresh");
  });

  test("skips a session a trainer edited individually", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null }),
    });
    expect(decisions[0].action).toBe("skip_custom");
  });

  test("skips a completed session even when it came from this slot", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ completedAt: "2026-09-22T18:00:00.000Z" }),
    });
    expect(decisions[0].action).toBe("skip_completed");
  });

  test("a completed session that was edited individually reads as completed", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null, completedAt: "2026-09-22T18:00:00.000Z" }),
    });
    expect(decisions[0].action).toBe("skip_completed");
  });

  test("skips a session another slot wrote the same day", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotId: OTHER_SLOT }),
    });
    expect(decisions[0].action).toBe("skip_other_slot");
  });

  test("a session with no slot at all is individual work, not another slot", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotId: null, slotWorkoutSyncedAt: null }),
    });
    expect(decisions[0].action).toBe("skip_custom");
  });

  test("keeps the caller's order and carries the name through", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {});
    expect(decisions.map((d) => d.traineeName)).toEqual(["נועם", "עומר"]);
  });
});

describe("countFanout", () => {
  test("counts one entry per action that occurred", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null }),
    });
    expect(countFanout(decisions)).toEqual({ skip_custom: 1, create: 1 });
  });

  test("an empty roster counts nothing", () => {
    expect(countFanout([])).toEqual({});
  });
});

describe("describeFanout", () => {
  test("names how many received the workout", () => {
    expect(describeFanout({ create: 3 })).toBe("האימון נשלח ל-3 מתאמנים");
  });

  test("counts a refresh as received", () => {
    expect(describeFanout({ create: 1, refresh: 2 })).toBe("האימון נשלח ל-3 מתאמנים");
  });

  test("uses the singular for one trainee", () => {
    expect(describeFanout({ create: 1 })).toBe("האימון נשלח למתאמן אחד");
  });

  test("says why trainees were skipped", () => {
    expect(describeFanout({ create: 2, skip_custom: 1, skip_completed: 1 })).toBe(
      "האימון נשלח ל-2 מתאמנים. דילוג: 1 עם אימון אישי, 1 שכבר הושלם",
    );
  });

  test("reports a slot clash on its own", () => {
    expect(describeFanout({ skip_other_slot: 2 })).toBe(
      "איש לא קיבל את האימון. דילוג: 2 עם אימון מסלוט אחר באותו יום",
    );
  });

  test("an empty roster says so plainly", () => {
    expect(describeFanout({})).toBe("אין רשומים לסלוט, האימון נשמר בלבד");
  });
});
