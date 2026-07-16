import { isValidUUID } from "./common";
import {
  MAX_SHIFT_HOURS,
  MORNING_SHIFT_END_HOUR,
  MORNING_SHIFT_START_HOUR,
  type ShiftPeriod,
} from "@/lib/constants/shifts";
import {
  isMorningShiftAllowed,
  isWithinMorningWindow,
} from "@/lib/utils/israel-time";

export type ShiftChangeRequestInput =
  | {
      type: "retro_add";
      target_shift_id?: string;
      shift_period?: ShiftPeriod;
      requested_start_time: string;
      requested_end_time: string;
      reason?: string;
    }
  | {
      type: "edit";
      target_shift_id: string;
      shift_period?: ShiftPeriod;
      requested_start_time: string;
      requested_end_time: string;
      reason?: string;
    };

/** Rows predate the shift_period column, and older clients may omit it. */
export function normalizeShiftPeriod(value: ShiftPeriod | undefined): ShiftPeriod {
  return value === "morning" ? "morning" : "regular";
}

export const MORNING_WINDOW_ERROR = `משמרת בוקר חייבת להיות בין ${String(
  MORNING_SHIFT_START_HOUR
).padStart(2, "0")}:00 ל-${String(MORNING_SHIFT_END_HOUR).padStart(2, "0")}:00`;

export const MORNING_ON_FRIDAY_ERROR = "אין משמרת בוקר בימי שישי";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const MS_PER_HOUR = 60 * 60 * 1000;

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function validateShiftChangeRequestInput(
  input: ShiftChangeRequestInput
): ValidationResult {
  const start = parseTimestamp(input.requested_start_time);
  const end = parseTimestamp(input.requested_end_time);
  if (!start || !end) {
    return { valid: false, error: "תאריך או שעה לא תקינים" };
  }

  if (end.getTime() <= start.getTime()) {
    return { valid: false, error: "שעת סיום חייבת להיות אחרי שעת התחלה" };
  }

  const durationHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;
  if (durationHours > MAX_SHIFT_HOURS) {
    return {
      valid: false,
      error: `משמרת לא יכולה להיות ארוכה יותר מ-${MAX_SHIFT_HOURS} שעות`,
    };
  }

  if (end.getTime() > Date.now()) {
    return { valid: false, error: "שעת סיום חייבת להיות בעבר" };
  }

  if (normalizeShiftPeriod(input.shift_period) === "morning") {
    if (!isMorningShiftAllowed(start)) {
      return { valid: false, error: MORNING_ON_FRIDAY_ERROR };
    }
    if (!isWithinMorningWindow(start, end)) {
      return { valid: false, error: MORNING_WINDOW_ERROR };
    }
  }

  if (input.type === "edit") {
    if (!input.target_shift_id || !isValidUUID(input.target_shift_id)) {
      return { valid: false, error: "מזהה משמרת לעריכה אינו תקין" };
    }
  } else {
    if (input.target_shift_id !== undefined && input.target_shift_id !== null) {
      return {
        valid: false,
        error: "בקשת הוספת משמרת לא יכולה לכלול מזהה משמרת קיימת",
      };
    }
  }

  return { valid: true };
}

export type RequestForResolve = {
  id: string;
  trainer_id: string;
  request_type: "edit" | "retro_add";
  target_shift_id: string | null;
  requested_start_time: string;
  requested_end_time: string;
  shift_period: ShiftPeriod;
};

export type ShiftForResolve = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string | null;
  shift_period: ShiftPeriod;
};

export type ApprovalMode =
  | { mode: "edit"; resolvedShiftId: string }
  | { mode: "retro_insert"; resolvedShiftId: null }
  | { mode: "retro_merge"; resolvedShiftId: string }
  | { error: "TARGET_DELETED" }
  | { error: "MULTI_MATCH" };

export function resolveApprovalMode(
  request: RequestForResolve,
  sameDayShifts: ShiftForResolve[],
  targetShift: ShiftForResolve | null
): ApprovalMode {
  if (request.request_type === "edit") {
    if (!targetShift) {
      return { error: "TARGET_DELETED" };
    }
    return { mode: "edit", resolvedShiftId: targetShift.id };
  }

  // Scope by period: a day legitimately holds one morning and one regular
  // shift. Without this filter a morning retro_add would resolve to
  // retro_merge against the day's regular shift and overwrite its times.
  const samePeriod = sameDayShifts.filter(
    (s) => s.shift_period === request.shift_period
  );

  if (samePeriod.length === 0) {
    return { mode: "retro_insert", resolvedShiftId: null };
  }
  if (samePeriod.length === 1) {
    return { mode: "retro_merge", resolvedShiftId: samePeriod[0].id };
  }
  return { error: "MULTI_MATCH" };
}

export type OverlapCandidate = {
  start: string;
  end: string;
  excludeShiftId?: string;
};

// Adjacent shifts (one's end == other's start) are NOT considered overlapping.
// Shifts with end_time === null (still active) are skipped — they aren't yet a
// closed paid block.
export function detectShiftOverlap(
  candidate: OverlapCandidate,
  shifts: ShiftForResolve[]
): ShiftForResolve | null {
  const candidateStart = new Date(candidate.start).getTime();
  const candidateEnd = new Date(candidate.end).getTime();

  for (const s of shifts) {
    if (candidate.excludeShiftId && s.id === candidate.excludeShiftId) continue;
    if (!s.end_time) continue;
    const shiftStart = new Date(s.start_time).getTime();
    const shiftEnd = new Date(s.end_time).getTime();
    if (shiftStart < candidateEnd && shiftEnd > candidateStart) {
      return s;
    }
  }
  return null;
}

const HEBREW_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Jerusalem",
};
const HEBREW_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jerusalem",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", HEBREW_TIME_OPTS).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", HEBREW_DATE_OPTS).format(new Date(iso));
}

export function formatRequestSummary(request: {
  request_type: "edit" | "retro_add";
  requested_start_time: string;
  requested_end_time: string;
  shift_period?: ShiftPeriod;
}): string {
  const verb = request.request_type === "retro_add" ? "הוספת משמרת" : "עריכת משמרת";
  // "הוספת משמרת בוקר 14/03 08:00–11:00" — the verb already carries "משמרת",
  // so morning only appends the qualifier.
  const qualifier =
    normalizeShiftPeriod(request.shift_period) === "morning" ? " בוקר" : "";
  const date = formatDate(request.requested_start_time);
  const start = formatTime(request.requested_start_time);
  const end = formatTime(request.requested_end_time);
  return `${verb}${qualifier} ${date} ${start}–${end}`;
}
