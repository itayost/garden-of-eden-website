import { describe, expect, test } from "vitest";

import {
  exerciseToBuilderRow,
  programWeekToBuilderRows,
  templateToBuilderRows,
} from "@/lib/utils/session-import";
import type { ProgramGrid, WorkoutExercise } from "@/features/workouts/lib/types";
import type { EquipmentProfile } from "@/types/equipment";
import type { SessionTemplate } from "@/types/session-template";

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

// ---------------------------------------------------------------------------
// exerciseToBuilderRow
// ---------------------------------------------------------------------------

function machine(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: "eq-1",
    name_he: "מכשיר",
    tracks_weight: false,
    tracks_reps: false,
    tracks_duration: false,
    tracks_distance: false,
    default_sets: null,
    default_reps: null,
    default_weight_kg: null,
    default_duration_seconds: null,
    default_distance_m: null,
    weight_min_kg: null,
    weight_max_kg: null,
    weight_step_kg: null,
    howto_he: null,
    ...overrides,
  };
}

function libraryExercise(
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  return {
    id: "e-1",
    mainCategory: "כוח - פלג גוף עליון וליבה",
    subCategory: null,
    nameHe: "לחיצת חזה",
    nameEn: null,
    equipment: null,
    equipmentId: null,
    equipmentName: null,
    equipmentCode: null,
    equipmentProfile: null,
    defaultSets: null,
    defaultReps: null,
    defaultWeightKg: null,
    defaultDurationSeconds: null,
    defaultDistanceM: null,
    cuesHe: null,
    goalHe: null,
    orderIndex: 0,
    ...overrides,
  };
}

describe("exerciseToBuilderRow", () => {
  test("leaves a row with no machine bare", () => {
    const row = exerciseToBuilderRow(libraryExercise(), "k-1");

    expect(row).toMatchObject({
      key: "k-1",
      exerciseId: "e-1",
      exerciseName: "לחיצת חזה",
      equipment: null,
      targetSets: null,
      targetWeightKg: "",
    });
    expect(row.seededFromEquipment).toBeUndefined();
  });

  test("seeds only the measures the machine tracks", () => {
    const row = exerciseToBuilderRow(
      libraryExercise({
        equipmentProfile: machine({
          tracks_weight: true,
          tracks_reps: true,
          default_sets: 3,
          default_reps: 10,
          default_weight_kg: 40,
          // Tracked by nothing here, so it must not reach the row.
          default_distance_m: 500,
        }),
      }),
      "k-2",
    );

    expect(row).toMatchObject({
      targetSets: 3,
      targetRepsNum: "10",
      targetWeightKg: "40",
      targetDurationSeconds: "",
      targetDistanceM: "",
      seededFromEquipment: true,
    });
  });

  test("an exercise's own default overrides the machine's", () => {
    const row = exerciseToBuilderRow(
      libraryExercise({
        defaultWeightKg: 55,
        equipmentProfile: machine({ tracks_weight: true, default_weight_kg: 40 }),
      }),
      "k-3",
    );

    expect(row.targetWeightKg).toBe("55");
  });

  test("falls back to the English name, then to a placeholder", () => {
    expect(
      exerciseToBuilderRow(libraryExercise({ nameHe: null, nameEn: "Bench" }), "k")
        .exerciseName,
    ).toBe("Bench");
    expect(
      exerciseToBuilderRow(libraryExercise({ nameHe: null, nameEn: null }), "k")
        .exerciseName,
    ).toBe("תרגיל");
  });
});

// ---------------------------------------------------------------------------
// templateToBuilderRows
// ---------------------------------------------------------------------------

function template(
  overrides: Partial<SessionTemplate> = {},
): SessionTemplate {
  return {
    id: "t-1",
    name: "פלג גוף עליון א",
    description: null,
    created_by: "u-1",
    created_by_name: "מאמן",
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    exercises: [
      {
        id: "te-1",
        template_id: "t-1",
        exercise_id: "e-1",
        order_index: 0,
        target_sets: 4,
        target_reps_he: "8-10",
        target_load_he: null,
        target_reps: 9,
        target_weight_kg: 42.5,
        target_duration_seconds: null,
        target_distance_m: null,
        notes_he: "לאט בירידה",
        exercise: {
          id: "e-1",
          name_he: "לחיצת חזה",
          name_en: null,
          main_category: "כוח - פלג גוף עליון וליבה",
          sub_category: null,
          equipment: null,
          equipment_ref: machine({ tracks_weight: true, tracks_reps: true }),
        },
      },
      {
        id: "te-2",
        template_id: "t-1",
        exercise_id: "e-2",
        order_index: 1,
        target_sets: 3,
        target_reps_he: "עד כשל",
        target_load_he: 'משקל גוף',
        target_reps: null,
        target_weight_kg: null,
        target_duration_seconds: null,
        target_distance_m: null,
        notes_he: null,
        exercise: {
          id: "e-2",
          name_he: "שכיבות סמיכה",
          name_en: null,
          main_category: "כוח - פלג גוף עליון וליבה",
          sub_category: null,
          equipment: null,
          equipment_ref: null,
        },
      },
    ],
    ...overrides,
  };
}

describe("templateToBuilderRows", () => {
  test("round-trips every numeric target, unlike a program week", () => {
    const rows = templateToBuilderRows(template());

    expect(rows[0]).toMatchObject({
      exerciseId: "e-1",
      exerciseName: "לחיצת חזה",
      targetSets: 4,
      targetReps: "8-10",
      targetRepsNum: "9",
      targetWeightKg: "42.5",
      notes: "לאט בירידה",
    });
  });

  test("restores the machine profile so the row renders machine inputs", () => {
    const rows = templateToBuilderRows(template());

    expect(rows[0].equipment).toMatchObject({ id: "eq-1", tracks_weight: true });
    expect(rows[1].equipment).toBeNull();
  });

  test("keeps the free-text targets of a row with no machine", () => {
    const rows = templateToBuilderRows(template());

    expect(rows[1]).toMatchObject({
      targetReps: "עד כשל",
      targetLoad: "משקל גוף",
      targetRepsNum: "",
      targetWeightKg: "",
    });
  });

  test("never claims saved numbers are machine defaults", () => {
    for (const row of templateToBuilderRows(template())) {
      expect(row.seededFromEquipment).toBe(false);
    }
  });

  test("generates unique client keys", () => {
    const rows = templateToBuilderRows(template());

    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  test("returns an empty list for a template with no exercises", () => {
    expect(templateToBuilderRows(template({ exercises: [] }))).toEqual([]);
  });
});
