/**
 * A nutrition measurement dated in the Report week and the dietitian's
 * recommendation. Shown to readers by code, never given to the model. Pure.
 */

import { round1, textOrNull } from "./format";
import type { BodyFacts, TraineeWeekInput } from "./types";

function difference(current: number | null, earlier: number | null): number | null {
  return current === null || earlier === null ? null : round1(current - earlier);
}

export function bodyFacts(
  measurement: TraineeWeekInput["measurement"],
  dietitianNote: string | null,
): BodyFacts | null {
  const { inWeek, previous } = measurement;
  if (inWeek === null) return null;
  return {
    date: inWeek.measurement_date,
    weightKg: inWeek.weight_kg,
    heightCm: inWeek.height_cm,
    bmi: inWeek.bmi,
    bmiPercentile: inWeek.bmi_percentile,
    heightPercentile: inWeek.height_percentile,
    change: previous
      ? {
          weightKg: difference(inWeek.weight_kg, previous.weight_kg),
          heightCm: difference(inWeek.height_cm, previous.height_cm),
        }
      : null,
    dietitianNote: textOrNull(dietitianNote),
  };
}
