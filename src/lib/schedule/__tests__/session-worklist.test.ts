import { describe, expect, test } from "vitest";

import {
  buildSessionWorklist,
  filterWorklist,
  worklistProgress,
} from "../session-worklist";
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";

const LIDOR = "11111111-1111-4111-8111-111111111111";
const NADAV = "22222222-2222-4222-8222-222222222222";
const NOAM = "33333333-3333-4333-8333-333333333333";
const OMER = "44444444-4444-4444-8444-444444444444";

function entry(overrides: Partial<SlotTrainee> = {}): SlotTrainee {
  return {
    id: "entry-1",
    slot_id: "slot-1",
    trainee_id: NOAM,
    trainee_name: "נועם",
    order_index: 0,
    source: "staff",
    booked_at: null,
    cancelled_at: null,
    late_cancel: false,
    reminded_at: null,
    ...overrides,
  };
}

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: "slot-1",
    schedule_date: "2026-09-16",
    start_time: "17:00:00",
    trainer_id: LIDOR,
    trainer_name: "לידור",
    focus_he: null,
    location_he: "סטודיו",
    branch_id: null,
    band_id: null,
    max_trainees: null,
    trainees: [],
    created_by: LIDOR,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

function summary(traineeId: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return { id: `session-${traineeId}`, trainee_id: traineeId, exerciseCount: 5, completed_at: null, ...overrides };
}

describe("buildSessionWorklist", () => {
  test("excludes free-text and cancelled entries", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM }),
            entry({ id: "b", trainee_id: null, trainee_name: "אורח" }),
            entry({ id: "c", trainee_id: OMER, cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true }),
          ],
        }),
      ],
      {},
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.rosterEntryId)).toEqual(["a"]);
  });

  test("maps session summaries to not_built, built and completed", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM, order_index: 0 }),
            entry({ id: "b", trainee_id: OMER, order_index: 1 }),
            entry({ id: "c", trainee_id: NADAV, order_index: 2 }),
          ],
        }),
      ],
      {
        [OMER]: summary(OMER, { exerciseCount: 7 }),
        [NADAV]: summary(NADAV, { completed_at: "2026-09-16T18:00:00Z" }),
      },
    );
    expect(groups[0].rows.map((row) => [row.status, row.exerciseCount])).toEqual([
      ["not_built", 0],
      ["built", 7],
      ["completed", 5],
    ]);
  });

  test("sorts slots by start time then trainer name, rows by order_index", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "late", start_time: "18:00:00" }),
        slot({ id: "nadav", start_time: "17:00:00", trainer_name: "נדב" }),
        slot({
          id: "lidor",
          start_time: "17:00:00",
          trainer_name: "לידור",
          trainees: [
            entry({ id: "second", trainee_id: OMER, order_index: 1 }),
            entry({ id: "first", trainee_id: NOAM, order_index: 0 }),
          ],
        }),
      ],
      {},
    );
    expect(groups.map((group) => group.slotId)).toEqual(["lidor", "nadav", "late"]);
    expect(groups[0].startTime).toBe("17:00");
    expect(groups[0].rows.map((row) => row.rosterEntryId)).toEqual(["first", "second"]);
  });

  test("a trainee in two slots appears in both, sharing the day's status", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "one", start_time: "16:00:00", trainees: [entry({ id: "a", trainee_id: NOAM })] }),
        slot({ id: "two", start_time: "18:00:00", trainees: [entry({ id: "b", trainee_id: NOAM })] }),
      ],
      { [NOAM]: summary(NOAM) },
    );
    expect(groups.map((group) => group.rows[0].status)).toEqual(["built", "built"]);
  });

  test("does not mutate the input slots", () => {
    const input = [slot({ id: "b", start_time: "18:00:00" }), slot({ id: "a", start_time: "16:00:00" })];
    buildSessionWorklist(input, {});
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("filterWorklist", () => {
  const groups = buildSessionWorklist(
    [
      slot({ id: "mine", trainer_id: LIDOR, trainees: [entry({ id: "a", trainee_id: NOAM })] }),
      slot({
        id: "theirs",
        start_time: "18:00:00",
        trainer_id: NADAV,
        trainees: [entry({ id: "b", trainee_id: OMER })],
      }),
    ],
    { [NOAM]: summary(NOAM) },
  );

  test("no filters keeps every group with rows", () => {
    const result = filterWorklist(groups, { mineOnly: false, pendingOnly: false, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["mine", "theirs"]);
  });

  test("mineOnly keeps the viewer's slots", () => {
    const result = filterWorklist(groups, { mineOnly: true, pendingOnly: false, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["mine"]);
  });

  test("pendingOnly keeps not_built rows and drops groups left empty", () => {
    const result = filterWorklist(groups, { mineOnly: false, pendingOnly: true, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["theirs"]);
  });

  test("drops groups with no linked trainees", () => {
    const withEmpty = buildSessionWorklist([slot({ id: "empty" })], {});
    expect(filterWorklist(withEmpty, { mineOnly: false, pendingOnly: false, currentUserId: LIDOR })).toEqual([]);
  });
});

describe("worklistProgress", () => {
  test("counts built and completed rows over all rows", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM }),
            entry({ id: "b", trainee_id: OMER }),
            entry({ id: "c", trainee_id: NADAV }),
          ],
        }),
      ],
      { [NOAM]: summary(NOAM), [NADAV]: summary(NADAV, { completed_at: "2026-09-16T18:00:00Z" }) },
    );
    expect(worklistProgress(groups)).toEqual({ built: 2, total: 3 });
  });
});
