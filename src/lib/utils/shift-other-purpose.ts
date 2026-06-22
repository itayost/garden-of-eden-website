import {
  SHIFT_OTHER_PURPOSE_CATEGORIES,
  type ShiftOtherPurposeCategory,
} from "@/lib/constants/shifts";

export interface ShiftTimeInput {
  readonly start_time: string;
  readonly end_time: string | null;
  readonly other_purpose_minutes: number;
}

export interface ShiftMinutesSplit {
  readonly grossMinutes: number;
  readonly otherMinutes: number;
  readonly trainingMinutes: number;
}

/** Split a shift into gross / other-purpose / training minutes. Other is
 * clamped to the gross duration so training never goes negative. For an open
 * shift (no end_time) the gross runs to `now`. */
export function splitShiftMinutes(
  shift: ShiftTimeInput,
  now: number = Date.now(),
): ShiftMinutesSplit {
  const start = new Date(shift.start_time).getTime();
  const end = shift.end_time ? new Date(shift.end_time).getTime() : now;
  const grossMinutes = Math.max(0, Math.round((end - start) / 60000));
  const otherMinutes = Math.max(
    0,
    Math.min(shift.other_purpose_minutes ?? 0, grossMinutes),
  );
  return {
    grossMinutes,
    otherMinutes,
    trainingMinutes: grossMinutes - otherMinutes,
  };
}

export type OtherPurposeValidation =
  | { ok: true; minutes: number; category: ShiftOtherPurposeCategory | null }
  | { ok: false; error: string };

/** Validate an other-purpose entry. Non-integer input (including NaN) is
 * rejected outright. An integer minutes <= 0 means "clear" (0 + null).
 * Otherwise minutes must be a positive integer within the shift duration and
 * the category must be one of the presets. */
export function validateOtherPurpose(
  minutes: number,
  category: string | null,
  shiftDurationMinutes: number,
): OtherPurposeValidation {
  if (!Number.isInteger(minutes)) {
    return { ok: false, error: "משך זמן לא תקין" };
  }
  if (minutes <= 0) {
    return { ok: true, minutes: 0, category: null };
  }
  if (
    !category ||
    !SHIFT_OTHER_PURPOSE_CATEGORIES.includes(category as ShiftOtherPurposeCategory)
  ) {
    return { ok: false, error: "יש לבחור קטגוריה" };
  }
  if (minutes > shiftDurationMinutes) {
    return { ok: false, error: "הזמן למטרות אחרות חורג ממשך המשמרת" };
  }
  return { ok: true, minutes, category: category as ShiftOtherPurposeCategory };
}
