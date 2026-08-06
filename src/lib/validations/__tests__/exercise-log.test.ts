import { describe, expect, test } from "vitest";

import { exerciseLogSchema } from "@/lib/validations/exercise-log";

const EXERCISE = "11111111-1111-4111-8111-111111111111";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    exerciseId: EXERCISE,
    sessionExerciseId: null,
    equipmentId: null,
    sets: 3,
    reps: 10,
    weightKg: 20,
    note: "",
    ...overrides,
  };
}

describe("exerciseLogSchema", () => {
  test("accepts a full log", () => {
    expect(exerciseLogSchema.safeParse(validInput()).success).toBe(true);
  });

  test("accepts a bodyweight log with no weight", () => {
    const result = exerciseLogSchema.parse(validInput({ weightKg: "" }));

    expect(result.weightKg).toBe(null);
  });

  test("rejects a log with no numbers at all", () => {
    expect(
      exerciseLogSchema.safeParse(
        validInput({ sets: "", reps: "", weightKg: "" }),
      ).success,
    ).toBe(false);
  });

  test("coerces form strings and truncates fractional sets/reps", () => {
    const result = exerciseLogSchema.parse(
      validInput({ sets: "4", reps: "12.7", weightKg: "22.5" }),
    );

    expect(result.sets).toBe(4);
    expect(result.reps).toBe(12);
    expect(result.weightKg).toBe(22.5);
  });

  test("allows weight zero (bodyweight marker) but not negative", () => {
    expect(
      exerciseLogSchema.safeParse(validInput({ weightKg: 0 })).success,
    ).toBe(true);
    expect(
      exerciseLogSchema.safeParse(validInput({ weightKg: -5 })).success,
    ).toBe(false);
  });

  test("rejects out-of-range values", () => {
    expect(exerciseLogSchema.safeParse(validInput({ sets: 100 })).success).toBe(false);
    expect(exerciseLogSchema.safeParse(validInput({ reps: 1000 })).success).toBe(false);
    expect(exerciseLogSchema.safeParse(validInput({ weightKg: 501 })).success).toBe(false);
  });

  test("empty note becomes null", () => {
    expect(exerciseLogSchema.parse(validInput()).note).toBe(null);
  });
});
