import { describe, expect, test } from "vitest";

import {
  formatExerciseTarget,
  toRosterExercises,
  type ExerciseTarget,
  type SessionExerciseRow,
} from "@/lib/schedule/roster-exercise";

const EMPTY: ExerciseTarget = {
  target_sets: null,
  target_reps_he: null,
  target_reps: null,
  target_load_he: null,
  target_weight_kg: null,
  target_duration_seconds: null,
  target_distance_m: null,
};

describe("formatExerciseTarget", () => {
  test("joins sets and numeric reps with a multiplication sign", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_sets: 3, target_reps: 10 })).toBe("3×10");
  });

  test("free-text reps win over the numeric reps", () => {
    const target = { ...EMPTY, target_sets: 4, target_reps: 10, target_reps_he: "8-10" };

    expect(formatExerciseTarget(target)).toBe("4×8-10");
  });

  test("keeps free-text reps that are not a number at all", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_sets: 3, target_reps_he: "עד כשל" })).toBe("3×עד כשל");
  });

  test("renders reps without sets on their own", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_reps: 12 })).toBe("12");
  });

  test("renders sets without reps on their own", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_sets: 5 })).toBe("5");
  });

  test("appends free-text load after the sets and reps", () => {
    const target = { ...EMPTY, target_sets: 3, target_reps: 10, target_load_he: "עם גומייה" };

    expect(formatExerciseTarget(target)).toBe("3×10 · עם גומייה");
  });

  test("free-text load wins over the numeric weight", () => {
    const target = { ...EMPTY, target_sets: 3, target_load_he: "משקל גוף", target_weight_kg: 40 };

    expect(formatExerciseTarget(target)).toBe("3 · משקל גוף");
  });

  test("renders the numeric weight in kilograms", () => {
    const target = { ...EMPTY, target_sets: 3, target_reps: 8, target_weight_kg: 42.5 };

    expect(formatExerciseTarget(target)).toBe('3×8 · 42.5 ק"ג');
  });

  test("renders a duration as mm:ss", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_duration_seconds: 45 })).toBe("00:45");
  });

  test("renders a distance in metres", () => {
    expect(formatExerciseTarget({ ...EMPTY, target_distance_m: 20 })).toBe("20 מ׳");
  });

  test("keeps every part that was given, in a fixed order", () => {
    const target: ExerciseTarget = {
      target_sets: 4,
      target_reps_he: null,
      target_reps: 6,
      target_load_he: null,
      target_weight_kg: 30,
      target_duration_seconds: 30,
      target_distance_m: 15,
    };

    expect(formatExerciseTarget(target)).toBe('4×6 · 30 ק"ג · 00:30 · 15 מ׳');
  });

  test("returns an empty string when the trainer set no target", () => {
    expect(formatExerciseTarget(EMPTY)).toBe("");
  });
});

const row = (over: Partial<SessionExerciseRow> = {}): SessionExerciseRow => ({
  ...EMPTY,
  id: "e1",
  order_index: 0,
  notes_he: null,
  exercise: { name_he: "סקוואט", name_en: "Squat" },
  ...over,
});

describe("toRosterExercises", () => {
  test("orders the exercises the way the trainer built them", () => {
    const rows = [
      row({ id: "c", order_index: 2, exercise: { name_he: "ריצה", name_en: null } }),
      row({ id: "a", order_index: 0, exercise: { name_he: "סקוואט", name_en: null } }),
      row({ id: "b", order_index: 1, exercise: { name_he: "קפיצה", name_en: null } }),
    ];

    expect(toRosterExercises(rows).map((exercise) => exercise.name)).toEqual([
      "סקוואט",
      "קפיצה",
      "ריצה",
    ]);
  });

  test("prefers the Hebrew name", () => {
    expect(toRosterExercises([row()])[0].name).toBe("סקוואט");
  });

  test("falls back to the English name when there is no Hebrew one", () => {
    const exercises = toRosterExercises([row({ exercise: { name_he: null, name_en: "Box Jump" } })]);

    expect(exercises[0].name).toBe("Box Jump");
  });

  test("names an exercise whose library row did not come back", () => {
    expect(toRosterExercises([row({ exercise: null })])[0].name).toBe("תרגיל");
  });

  test("carries the formatted target and the note", () => {
    const exercises = toRosterExercises([
      row({ target_sets: 3, target_reps: 10, notes_he: "לשמור על גב ישר" }),
    ]);

    expect(exercises[0]).toMatchObject({ target: "3×10", notes: "לשמור על גב ישר" });
  });

  test("returns an empty list for a session with no exercises", () => {
    expect(toRosterExercises([])).toEqual([]);
  });
});
