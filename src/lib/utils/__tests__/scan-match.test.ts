import { describe, expect, test } from "vitest";

import { findScanTarget, type ScanCandidate } from "@/lib/utils/scan-match";

const EQUIPMENT = "eq-1";
const OTHER_EQUIPMENT = "eq-2";

function candidate(overrides: Partial<ScanCandidate> = {}): ScanCandidate {
  return {
    sessionExerciseId: "se-1",
    equipmentId: EQUIPMENT,
    hasLog: false,
    ...overrides,
  };
}

describe("findScanTarget", () => {
  test("picks the first unlogged session exercise on the scanned equipment", () => {
    const result = findScanTarget(
      [
        candidate({ sessionExerciseId: "se-1", hasLog: true }),
        candidate({ sessionExerciseId: "se-2", hasLog: false }),
        candidate({ sessionExerciseId: "se-3", hasLog: false }),
      ],
      EQUIPMENT,
    );

    expect(result).toBe("se-2");
  });

  test("falls back to a logged exercise on that equipment when all are logged", () => {
    // Opening the already-logged exercise lets the trainee correct his entry.
    const result = findScanTarget(
      [candidate({ sessionExerciseId: "se-1", hasLog: true })],
      EQUIPMENT,
    );

    expect(result).toBe("se-1");
  });

  test("ignores exercises on other equipment", () => {
    const result = findScanTarget(
      [candidate({ equipmentId: OTHER_EQUIPMENT })],
      EQUIPMENT,
    );

    expect(result).toBe(null);
  });

  test("ignores exercises with no equipment link", () => {
    const result = findScanTarget([candidate({ equipmentId: null })], EQUIPMENT);

    expect(result).toBe(null);
  });

  test("returns null for an empty session — the free-log path", () => {
    expect(findScanTarget([], EQUIPMENT)).toBe(null);
  });
});
