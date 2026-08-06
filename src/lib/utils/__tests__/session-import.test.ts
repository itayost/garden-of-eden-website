import { describe, expect, test } from "vitest";

import { programWeekToBuilderRows } from "@/lib/utils/session-import";
import type { ProgramGrid } from "@/features/workouts/lib/types";

function grid(overrides: Partial<ProgramGrid> = {}): ProgramGrid {
  return {
    program: {
      id: "p-1",
      name: "תוכנית כוח",
      description: null,
      weeks: 3,
      periodizationType: null,
      createdBy: null,
      orderIndex: 0,
    },
    rows: [
      {
        key: "r-1",
        exerciseId: "e-1",
        exerciseName: "סקוואט",
        notesHe: "",
        cells: [
          { week: 1, sets: 3, repsHe: "8-10", loadHe: "40 ק\"ג", notesHe: "" },
          { week: 2, sets: 4, repsHe: "6-8", loadHe: "45 ק\"ג", notesHe: "שבוע כבד" },
          { week: 3, sets: null, repsHe: "", loadHe: "", notesHe: "" },
        ],
      },
      {
        key: "r-2",
        exerciseId: "e-2",
        exerciseName: "לחיצת חזה",
        notesHe: "",
        cells: [
          { week: 1, sets: 3, repsHe: "10", loadHe: "", notesHe: "" },
          { week: 2, sets: 3, repsHe: "10", loadHe: "", notesHe: "" },
          { week: 3, sets: 3, repsHe: "10", loadHe: "", notesHe: "" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("programWeekToBuilderRows", () => {
  test("maps the requested week's cells onto builder rows", () => {
    const rows = programWeekToBuilderRows(grid(), 2);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      exerciseId: "e-1",
      exerciseName: "סקוואט",
      targetSets: 4,
      targetReps: "6-8",
      targetLoad: "45 ק\"ג",
      notes: "שבוע כבד",
    });
    expect(rows[1]).toMatchObject({ exerciseId: "e-2", targetSets: 3 });
  });

  test("keeps a row whose cell for that week is empty — targets just stay blank", () => {
    const rows = programWeekToBuilderRows(grid(), 3);

    expect(rows[0]).toMatchObject({
      exerciseId: "e-1",
      targetSets: null,
      targetReps: "",
      targetLoad: "",
    });
  });

  test("clamps an out-of-range week into the program's range", () => {
    expect(programWeekToBuilderRows(grid(), 0)[0].targetSets).toBe(3);
    expect(programWeekToBuilderRows(grid(), 99)[0].targetSets).toBe(null);
  });

  test("generates unique client keys", () => {
    const rows = programWeekToBuilderRows(grid(), 1);

    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  test("returns an empty list for a program with no rows", () => {
    expect(programWeekToBuilderRows(grid({ rows: [] }), 1)).toEqual([]);
  });
});
