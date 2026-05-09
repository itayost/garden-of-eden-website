import { isValidUUID } from "./common";
import { MAX_SHIFT_HOURS } from "@/lib/constants/shifts";

export type ShiftChangeRequestInput =
  | {
      type: "retro_add";
      target_shift_id?: string;
      requested_start_time: string;
      requested_end_time: string;
      reason?: string;
    }
  | {
      type: "edit";
      target_shift_id: string;
      requested_start_time: string;
      requested_end_time: string;
      reason?: string;
    };

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
};

export type ShiftForResolve = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string | null;
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

  if (sameDayShifts.length === 0) {
    return { mode: "retro_insert", resolvedShiftId: null };
  }
  if (sameDayShifts.length === 1) {
    return { mode: "retro_merge", resolvedShiftId: sameDayShifts[0].id };
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
}): string {
  const verb = request.request_type === "retro_add" ? "הוספת משמרת" : "עריכת משמרת";
  const date = formatDate(request.requested_start_time);
  const start = formatTime(request.requested_start_time);
  const end = formatTime(request.requested_end_time);
  return `${verb} ${date} ${start}–${end}`;
}
