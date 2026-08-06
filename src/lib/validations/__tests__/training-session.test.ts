import { describe, expect, test } from "vitest";

import { upsertSessionSchema } from "@/lib/validations/training-session";

const TRAINEE = "11111111-1111-4111-8111-111111111111";
const EXERCISE = "22222222-2222-4222-8222-222222222222";
const SLOT = "33333333-3333-4333-8333-333333333333";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    traineeId: TRAINEE,
    sessionDate: "2026-08-06",
    slotId: SLOT,
    notes: "",
    exercises: [
      { exerciseId: EXERCISE, targetSets: 3, targetReps: "8-10", targetLoad: "", notes: "" },
    ],
    ...overrides,
  };
}

describe("upsertSessionSchema", () => {
  test("accepts a valid session", () => {
    expect(upsertSessionSchema.safeParse(validInput()).success).toBe(true);
  });

  test("normalizes a missing slotId to null", () => {
    const result = upsertSessionSchema.parse(validInput({ slotId: undefined }));

    expect(result.slotId).toBe(null);
  });

  test("requires at least one exercise", () => {
    expect(
      upsertSessionSchema.safeParse(validInput({ exercises: [] })).success,
    ).toBe(false);
  });

  test("coerces target sets from form strings, empty string to null", () => {
    const result = upsertSessionSchema.parse(
      validInput({
        exercises: [
          { exerciseId: EXERCISE, targetSets: "4", targetReps: "", targetLoad: "", notes: "" },
          { exerciseId: EXERCISE, targetSets: "", targetReps: "", targetLoad: "", notes: "" },
        ],
      }),
    );

    expect(result.exercises[0].targetSets).toBe(4);
    expect(result.exercises[1].targetSets).toBe(null);
  });

  test("rejects zero or out-of-range sets", () => {
    expect(
      upsertSessionSchema.safeParse(
        validInput({
          exercises: [
            { exerciseId: EXERCISE, targetSets: 0, targetReps: "", targetLoad: "", notes: "" },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      upsertSessionSchema.safeParse(
        validInput({
          exercises: [
            { exerciseId: EXERCISE, targetSets: 100, targetReps: "", targetLoad: "", notes: "" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  test("empty reps and load become null, not empty string", () => {
    const result = upsertSessionSchema.parse(validInput());

    expect(result.exercises[0].targetLoad).toBe(null);
    expect(result.exercises[0].targetReps).toBe("8-10");
  });

  test("rejects a non-UUID exercise id", () => {
    expect(
      upsertSessionSchema.safeParse(
        validInput({
          exercises: [
            { exerciseId: "nope", targetSets: 3, targetReps: "", targetLoad: "", notes: "" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  test("rejects an invalid date", () => {
    expect(
      upsertSessionSchema.safeParse(validInput({ sessionDate: "2026-13-01" })).success,
    ).toBe(false);
  });
});
