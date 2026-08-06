import { describe, expect, test } from "vitest";

import { TRAINER_PALETTES, trainerColor } from "@/lib/utils/trainer-color";

const TRAINER_A = "11111111-1111-4111-8111-111111111111";
const TRAINER_B = "22222222-2222-4222-8222-222222222222";

describe("trainerColor", () => {
  test("is deterministic — same id always maps to the same palette", () => {
    expect(trainerColor(TRAINER_A)).toBe(trainerColor(TRAINER_A));
    expect(trainerColor(TRAINER_A)).toEqual(trainerColor(TRAINER_A));
  });

  test("returns a palette from the predefined set", () => {
    expect(TRAINER_PALETTES).toContain(trainerColor(TRAINER_A));
    expect(TRAINER_PALETTES).toContain(trainerColor(TRAINER_B));
  });

  test("different ids can land on different palettes", () => {
    // Not guaranteed for arbitrary pairs (6 buckets), but these two differ.
    expect(trainerColor(TRAINER_A)).not.toBe(trainerColor(TRAINER_B));
  });

  test("null id falls back to the neutral palette", () => {
    const neutral = trainerColor(null);

    expect(neutral.dot).toContain("muted");
  });

  test("every palette has the three class slots", () => {
    for (const palette of TRAINER_PALETTES) {
      expect(palette.dot).toBeTruthy();
      expect(palette.text).toBeTruthy();
      expect(palette.bg).toBeTruthy();
    }
  });
});
