import { describe, expect, test } from "vitest";

import {
  FALLBACK_TRACKING_PROFILE,
  clampToStep,
  formatDuration,
  formatMeasures,
  resolveDefaults,
  resolveTrackingProfile,
  weightQuickAdds,
  type EquipmentProfileSource,
  type ExerciseDefaultsSource,
} from "@/lib/utils/performance-profile";

function equipment(
  overrides: Partial<EquipmentProfileSource> = {},
): EquipmentProfileSource {
  return {
    tracks_weight: true,
    tracks_reps: true,
    tracks_duration: false,
    tracks_distance: false,
    default_sets: null,
    default_reps: null,
    default_weight_kg: null,
    default_duration_seconds: null,
    default_distance_m: null,
    weight_min_kg: null,
    weight_max_kg: null,
    weight_step_kg: 2.5,
    ...overrides,
  };
}

function exercise(
  overrides: Partial<ExerciseDefaultsSource> = {},
): ExerciseDefaultsSource {
  return {
    default_sets: null,
    default_reps: null,
    default_weight_kg: null,
    default_duration_seconds: null,
    default_distance_m: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveTrackingProfile
// ---------------------------------------------------------------------------

describe("resolveTrackingProfile", () => {
  test("an exercise with no equipment falls back to today's exact form", () => {
    // Arrange / Act
    const result = resolveTrackingProfile(null);

    // Assert — sets, reps and weight, step 2.5, no bounds. This is the
    // pre-Phase-4 LogExerciseDialog, unchanged.
    expect(result).toEqual({
      tracksWeight: true,
      tracksReps: true,
      tracksDuration: false,
      tracksDistance: false,
      weightMinKg: null,
      weightMaxKg: null,
      weightStepKg: 2.5,
    });
    expect(result).toEqual(FALLBACK_TRACKING_PROFILE);
  });

  test("undefined equipment behaves the same as null", () => {
    expect(resolveTrackingProfile(undefined)).toEqual(FALLBACK_TRACKING_PROFILE);
  });

  test("reads the machine's flags", () => {
    const result = resolveTrackingProfile(
      equipment({
        tracks_weight: false,
        tracks_reps: false,
        tracks_duration: true,
        tracks_distance: true,
      }),
    );

    expect(result.tracksWeight).toBe(false);
    expect(result.tracksReps).toBe(false);
    expect(result.tracksDuration).toBe(true);
    expect(result.tracksDistance).toBe(true);
  });

  test("carries the weight stack through", () => {
    const result = resolveTrackingProfile(
      equipment({ weight_min_kg: 5, weight_max_kg: 60, weight_step_kg: 5 }),
    );

    expect(result.weightMinKg).toBe(5);
    expect(result.weightMaxKg).toBe(60);
    expect(result.weightStepKg).toBe(5);
  });

  test("a missing or non-positive step falls back to 2.5 rather than freezing the stepper", () => {
    expect(resolveTrackingProfile(equipment({ weight_step_kg: null })).weightStepKg).toBe(2.5);
    expect(resolveTrackingProfile(equipment({ weight_step_kg: 0 })).weightStepKg).toBe(2.5);
    expect(resolveTrackingProfile(equipment({ weight_step_kg: -5 })).weightStepKg).toBe(2.5);
  });

  test("a row with every flag off still yields a usable form", () => {
    // The DB CHECK forbids this, but a stale row or a bad import must not
    // render a dialog with no inputs at all.
    const result = resolveTrackingProfile(
      equipment({
        tracks_weight: false,
        tracks_reps: false,
        tracks_duration: false,
        tracks_distance: false,
      }),
    );

    expect(result).toEqual(FALLBACK_TRACKING_PROFILE);
  });
});

// ---------------------------------------------------------------------------
// resolveDefaults
// ---------------------------------------------------------------------------

describe("resolveDefaults", () => {
  test("inherits every measure from the equipment when the exercise sets none", () => {
    const result = resolveDefaults(
      exercise(),
      equipment({ default_sets: 3, default_reps: 10, default_weight_kg: 20 }),
    );

    expect(result).toEqual({
      sets: 3,
      reps: 10,
      weightKg: 20,
      durationSeconds: null,
      distanceM: null,
    });
  });

  test("the exercise override wins over the equipment", () => {
    const result = resolveDefaults(
      exercise({ default_sets: 4, default_reps: 8, default_weight_kg: 12 }),
      equipment({ default_sets: 3, default_reps: 10, default_weight_kg: 20 }),
    );

    expect(result).toEqual({
      sets: 4,
      reps: 8,
      weightKg: 12,
      durationSeconds: null,
      distanceM: null,
    });
  });

  test("a partial override inherits the measures it leaves null", () => {
    const result = resolveDefaults(
      exercise({ default_weight_kg: 12 }),
      equipment({ default_sets: 3, default_reps: 10, default_weight_kg: 20 }),
    );

    expect(result.sets).toBe(3);
    expect(result.reps).toBe(10);
    expect(result.weightKg).toBe(12);
  });

  test("zero is a real override and does not fall through to the equipment", () => {
    // ?? not ||: a bodyweight-assisted machine legitimately starts at 0kg.
    const result = resolveDefaults(
      exercise({ default_weight_kg: 0 }),
      equipment({ default_weight_kg: 20 }),
    );

    expect(result.weightKg).toBe(0);
  });

  test("no equipment leaves the exercise's own numbers intact", () => {
    const result = resolveDefaults(exercise({ default_sets: 4, default_reps: 8 }), null);

    expect(result).toEqual({
      sets: 4,
      reps: 8,
      weightKg: null,
      durationSeconds: null,
      distanceM: null,
    });
  });

  test("neither side set means every measure is null", () => {
    const result = resolveDefaults(null, null);

    expect(result).toEqual({
      sets: null,
      reps: null,
      weightKg: null,
      durationSeconds: null,
      distanceM: null,
    });
  });

  test("timed and cardio measures resolve the same way", () => {
    const result = resolveDefaults(
      exercise({ default_duration_seconds: 90 }),
      equipment({ default_duration_seconds: 60, default_distance_m: 1200 }),
    );

    expect(result.durationSeconds).toBe(90);
    expect(result.distanceM).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// weightQuickAdds
// ---------------------------------------------------------------------------

describe("weightQuickAdds", () => {
  test("derives three adds from the machine's own increment", () => {
    expect(weightQuickAdds(5)).toEqual([5, 10, 20]);
  });

  test("the 2.5 default reproduces a familiar plate ladder", () => {
    expect(weightQuickAdds(2.5)).toEqual([2.5, 5, 10]);
  });

  test("keeps one decimal place instead of float noise", () => {
    // 1.1 * 4 is 4.4000000000000004 in IEEE 754.
    expect(weightQuickAdds(1.1)).toEqual([1.1, 2.2, 4.4]);
  });

  test("a bad step falls back to the default ladder", () => {
    expect(weightQuickAdds(0)).toEqual([2.5, 5, 10]);
    expect(weightQuickAdds(-1)).toEqual([2.5, 5, 10]);
    expect(weightQuickAdds(Number.NaN)).toEqual([2.5, 5, 10]);
  });
});

// ---------------------------------------------------------------------------
// clampToStep
// ---------------------------------------------------------------------------

describe("clampToStep", () => {
  test("snaps to the nearest increment above the minimum", () => {
    // A 5kg stack starting at 5: 5, 10, 15, 20...
    expect(clampToStep(17, { min: 5, max: 60, step: 5 })).toBe(15);
    expect(clampToStep(18, { min: 5, max: 60, step: 5 })).toBe(20);
  });

  test("clamps a typo to the top of the stack", () => {
    // The 200kg-on-a-60kg-machine case.
    expect(clampToStep(200, { min: 5, max: 60, step: 5 })).toBe(60);
  });

  test("clamps below the minimum up to the minimum", () => {
    expect(clampToStep(1, { min: 5, max: 60, step: 5 })).toBe(5);
  });

  test("an unbounded machine only snaps, never clamps", () => {
    expect(clampToStep(23, { min: null, max: null, step: 2.5 })).toBe(22.5);
    expect(clampToStep(400, { min: null, max: null, step: 2.5 })).toBe(400);
  });

  test("avoids float artifacts on decimal steps", () => {
    expect(clampToStep(22.5, { min: null, max: null, step: 2.5 })).toBe(22.5);
    expect(clampToStep(7.5, { min: 0, max: 100, step: 2.5 })).toBe(7.5);
  });

  test("a non-finite value returns null rather than NaN", () => {
    expect(clampToStep(Number.NaN, { min: 0, max: 60, step: 5 })).toBeNull();
    expect(clampToStep(null, { min: 0, max: 60, step: 5 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// duration formatting
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  test("renders mm:ss", () => {
    expect(formatDuration(60)).toBe("01:00");
    expect(formatDuration(90)).toBe("01:30");
    expect(formatDuration(5)).toBe("00:05");
  });

  test("grows to h:mm:ss past an hour", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  test("null renders as an empty string, not a zero", () => {
    expect(formatDuration(null)).toBe("");
  });
});

describe("formatMeasures", () => {
  test("spells out sets and reps by default", () => {
    expect(
      formatMeasures({ sets: 3, reps: 10, weight_kg: 20 }),
    ).toBe('3 סטים · 10 חזרות · 20 ק"ג');
  });

  test("compact pairs sets and reps as 3 × 10", () => {
    expect(
      formatMeasures({ sets: 3, reps: 10, weight_kg: 20 }, { compact: true }),
    ).toBe('3 × 10 · 20 ק"ג');
  });

  test("compact falls back to spelled-out when only one of the pair is set", () => {
    expect(formatMeasures({ sets: 3 }, { compact: true })).toBe("3 סטים");
    expect(formatMeasures({ reps: 10 }, { compact: true })).toBe("10 חזרות");
  });

  test("renders a timed row with no sets, reps or weight", () => {
    expect(formatMeasures({ duration_seconds: 90 })).toBe("01:30");
  });

  test("renders a cardio row as time and distance", () => {
    expect(formatMeasures({ duration_seconds: 600, distance_m: 1200 })).toBe(
      "10:00 · 1200 מ׳",
    );
  });

  test("keeps a zero weight, which a bodyweight-assisted machine records", () => {
    expect(formatMeasures({ sets: 3, weight_kg: 0 })).toBe('3 סטים · 0 ק"ג');
  });

  test("an empty row renders as an empty string", () => {
    expect(formatMeasures({})).toBe("");
  });
});
