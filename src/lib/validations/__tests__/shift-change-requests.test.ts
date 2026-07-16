import { describe, it, expect } from "vitest";
import {
  validateShiftChangeRequestInput,
  resolveApprovalMode,
  detectShiftOverlap,
  formatRequestSummary,
  type ShiftChangeRequestInput,
  type RequestForResolve,
  type ShiftForResolve,
} from "../shift-change-requests";

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";
const VALID_UUID_C = "33333333-3333-4333-8333-333333333333";

const HOUR_MS = 60 * 60 * 1000;

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

// Fixed past instants pinned to Israel wall-clock time (2026-07-15 was a
// summer date, UTC+3). Used for the morning-window checks, which are
// timezone-sensitive and cannot use relative offsets.
const IL_0730 = "2026-07-15T04:30:00.000Z";
const IL_0800 = "2026-07-15T05:00:00.000Z";
const IL_0915 = "2026-07-15T06:15:00.000Z";
const IL_1030 = "2026-07-15T07:30:00.000Z";
const IL_1100 = "2026-07-15T08:00:00.000Z";
const IL_1130 = "2026-07-15T08:30:00.000Z";
const IL_1600 = "2026-07-15T13:00:00.000Z";

describe("validateShiftChangeRequestInput", () => {
  it("accepts a valid retro_add input", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
  });

  it("accepts a valid edit input", () => {
    const input: ShiftChangeRequestInput = {
      type: "edit",
      target_shift_id: VALID_UUID_A,
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
  });

  it("rejects when end <= start", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: isoHoursAgo(2),
      requested_end_time: isoHoursAgo(4),
    };
    const result = validateShiftChangeRequestInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("שעת סיום");
    }
  });

  it("rejects when end equals start", () => {
    const t = isoHoursAgo(2);
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: t,
      requested_end_time: t,
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(false);
  });

  it("rejects when duration exceeds 12 hours", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: isoHoursAgo(15),
      requested_end_time: isoHoursAgo(2),
    };
    const result = validateShiftChangeRequestInput(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("12");
    }
  });

  it("accepts when duration equals exactly 12 hours", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: isoHoursAgo(14),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(true);
  });

  it("rejects when end is in the future", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: isoHoursAgo(2),
      requested_end_time: new Date(Date.now() + HOUR_MS).toISOString(),
    };
    const result = validateShiftChangeRequestInput(input);
    expect(result.valid).toBe(false);
  });

  it("rejects edit input missing target_shift_id", () => {
    const input: ShiftChangeRequestInput = {
      type: "edit",
      target_shift_id: undefined as unknown as string,
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(false);
  });

  it("rejects edit input with invalid target_shift_id UUID", () => {
    const input: ShiftChangeRequestInput = {
      type: "edit",
      target_shift_id: "not-a-uuid",
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(false);
  });

  it("rejects retro_add input that includes target_shift_id", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      target_shift_id: VALID_UUID_A,
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(false);
  });

  it("rejects malformed timestamp", () => {
    const input: ShiftChangeRequestInput = {
      type: "retro_add",
      requested_start_time: "not a date",
      requested_end_time: isoHoursAgo(2),
    };
    expect(validateShiftChangeRequestInput(input).valid).toBe(false);
  });

  describe("morning window", () => {
    it("accepts a morning request filling exactly 08:00-11:00", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "morning",
        requested_start_time: IL_0800,
        requested_end_time: IL_1100,
      };
      expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
    });

    it("accepts a morning request nested inside the window", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "morning",
        requested_start_time: IL_0915,
        requested_end_time: IL_1030,
      };
      expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
    });

    it("rejects a morning request starting before 08:00", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "morning",
        requested_start_time: IL_0730,
        requested_end_time: IL_1100,
      };
      const result = validateShiftChangeRequestInput(input);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("משמרת בוקר");
      }
    });

    it("rejects a morning request ending after 11:00", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "morning",
        requested_start_time: IL_0800,
        requested_end_time: IL_1130,
      };
      expect(validateShiftChangeRequestInput(input).valid).toBe(false);
    });

    it("rejects a morning request spanning overnight", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "morning",
        requested_start_time: IL_0800,
        requested_end_time: "2026-07-16T06:00:00.000Z",
      };
      expect(validateShiftChangeRequestInput(input).valid).toBe(false);
    });

    it("does not apply the morning window to a regular request", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        shift_period: "regular",
        requested_start_time: IL_1100,
        requested_end_time: IL_1600,
      };
      expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
    });

    it("defaults an omitted shift_period to regular", () => {
      const input: ShiftChangeRequestInput = {
        type: "retro_add",
        requested_start_time: IL_1100,
        requested_end_time: IL_1600,
      };
      expect(validateShiftChangeRequestInput(input)).toEqual({ valid: true });
    });

    it("applies the morning window to edit requests too", () => {
      const input: ShiftChangeRequestInput = {
        type: "edit",
        target_shift_id: VALID_UUID_A,
        shift_period: "morning",
        requested_start_time: IL_0730,
        requested_end_time: IL_1100,
      };
      expect(validateShiftChangeRequestInput(input).valid).toBe(false);
    });
  });
});

describe("resolveApprovalMode", () => {
  function makeRequest(
    type: "edit" | "retro_add",
    overrides: Partial<RequestForResolve> = {}
  ): RequestForResolve {
    return {
      id: VALID_UUID_C,
      trainer_id: VALID_UUID_A,
      request_type: type,
      target_shift_id: type === "edit" ? VALID_UUID_B : null,
      requested_start_time: isoHoursAgo(4),
      requested_end_time: isoHoursAgo(2),
      shift_period: "regular",
      ...overrides,
    };
  }

  function makeShift(id: string, overrides: Partial<ShiftForResolve> = {}): ShiftForResolve {
    return {
      id,
      trainer_id: VALID_UUID_A,
      start_time: isoHoursAgo(8),
      end_time: isoHoursAgo(6),
      shift_period: "regular",
      ...overrides,
    };
  }

  it("returns mode 'edit' when edit-type and target shift exists", () => {
    const request = makeRequest("edit", { target_shift_id: VALID_UUID_B });
    const target = makeShift(VALID_UUID_B);
    const result = resolveApprovalMode(request, [target], target);
    expect(result).toEqual({ mode: "edit", resolvedShiftId: VALID_UUID_B });
  });

  it("returns target_deleted error when edit target is missing", () => {
    const request = makeRequest("edit");
    const result = resolveApprovalMode(request, [], null);
    expect(result).toEqual({ error: "TARGET_DELETED" });
  });

  it("returns mode 'retro_insert' when no same-day shifts exist", () => {
    const request = makeRequest("retro_add");
    const result = resolveApprovalMode(request, [], null);
    expect(result).toEqual({ mode: "retro_insert", resolvedShiftId: null });
  });

  it("returns mode 'retro_merge' when exactly one same-day shift exists", () => {
    const request = makeRequest("retro_add");
    const existing = makeShift(VALID_UUID_B);
    const result = resolveApprovalMode(request, [existing], null);
    expect(result).toEqual({ mode: "retro_merge", resolvedShiftId: VALID_UUID_B });
  });

  it("returns multi_match error when multiple same-day shifts exist", () => {
    const request = makeRequest("retro_add");
    const a = makeShift(VALID_UUID_B);
    const b = makeShift(VALID_UUID_C);
    const result = resolveApprovalMode(request, [a, b], null);
    expect(result).toEqual({ error: "MULTI_MATCH" });
  });

  describe("period scoping", () => {
    // The regression this feature exists to prevent: before period scoping, a
    // morning request landing on a day that already had a regular shift
    // resolved to retro_merge and OVERWROTE that regular shift's times.
    it("inserts a morning request rather than merging into an existing regular shift", () => {
      const request = makeRequest("retro_add", { shift_period: "morning" });
      const existingRegular = makeShift(VALID_UUID_B, { shift_period: "regular" });
      const result = resolveApprovalMode(request, [existingRegular], null);
      expect(result).toEqual({ mode: "retro_insert", resolvedShiftId: null });
    });

    it("inserts a regular request rather than merging into an existing morning shift", () => {
      const request = makeRequest("retro_add", { shift_period: "regular" });
      const existingMorning = makeShift(VALID_UUID_B, { shift_period: "morning" });
      const result = resolveApprovalMode(request, [existingMorning], null);
      expect(result).toEqual({ mode: "retro_insert", resolvedShiftId: null });
    });

    it("merges a morning request into the existing morning shift of that day", () => {
      const request = makeRequest("retro_add", { shift_period: "morning" });
      const existingMorning = makeShift(VALID_UUID_B, { shift_period: "morning" });
      const existingRegular = makeShift(VALID_UUID_C, { shift_period: "regular" });
      const result = resolveApprovalMode(
        request,
        [existingMorning, existingRegular],
        null
      );
      expect(result).toEqual({ mode: "retro_merge", resolvedShiftId: VALID_UUID_B });
    });

    it("multi_matches only on two shifts of the same period", () => {
      const request = makeRequest("retro_add", { shift_period: "morning" });
      const a = makeShift(VALID_UUID_B, { shift_period: "morning" });
      const b = makeShift(VALID_UUID_C, { shift_period: "morning" });
      expect(resolveApprovalMode(request, [a, b], null)).toEqual({
        error: "MULTI_MATCH",
      });
    });

    it("does not multi_match on one shift of each period", () => {
      const request = makeRequest("retro_add", { shift_period: "morning" });
      const morning = makeShift(VALID_UUID_B, { shift_period: "morning" });
      const regular = makeShift(VALID_UUID_C, { shift_period: "regular" });
      const result = resolveApprovalMode(request, [morning, regular], null);
      expect(result).toEqual({ mode: "retro_merge", resolvedShiftId: VALID_UUID_B });
    });

    it("ignores period scoping for edit requests", () => {
      const request = makeRequest("edit", {
        target_shift_id: VALID_UUID_B,
        shift_period: "morning",
      });
      const target = makeShift(VALID_UUID_B, { shift_period: "regular" });
      const result = resolveApprovalMode(request, [target], target);
      expect(result).toEqual({ mode: "edit", resolvedShiftId: VALID_UUID_B });
    });
  });
});

describe("detectShiftOverlap", () => {
  function shift(start: string, end: string, id = VALID_UUID_A): ShiftForResolve {
    return {
      id,
      trainer_id: VALID_UUID_B,
      start_time: start,
      end_time: end,
      shift_period: "regular",
    };
  }

  it("returns null when there are no other shifts", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(2) };
    expect(detectShiftOverlap(candidate, [])).toBeNull();
  });

  it("returns null when shifts do not overlap", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(2) };
    const other = shift(isoHoursAgo(10), isoHoursAgo(8));
    expect(detectShiftOverlap(candidate, [other])).toBeNull();
  });

  it("detects partial start overlap", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(2) };
    const other = shift(isoHoursAgo(5), isoHoursAgo(3));
    expect(detectShiftOverlap(candidate, [other])).toEqual(other);
  });

  it("detects partial end overlap", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(2) };
    const other = shift(isoHoursAgo(3), isoHoursAgo(1));
    expect(detectShiftOverlap(candidate, [other])).toEqual(other);
  });

  it("detects when candidate is fully contained in another", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(3) };
    const other = shift(isoHoursAgo(6), isoHoursAgo(2));
    expect(detectShiftOverlap(candidate, [other])).toEqual(other);
  });

  it("detects when candidate fully contains another", () => {
    const candidate = { start: isoHoursAgo(6), end: isoHoursAgo(2) };
    const other = shift(isoHoursAgo(5), isoHoursAgo(3));
    expect(detectShiftOverlap(candidate, [other])).toEqual(other);
  });

  it("detects exact same times as overlap", () => {
    const start = isoHoursAgo(4);
    const end = isoHoursAgo(2);
    const candidate = { start, end };
    const other = shift(start, end);
    expect(detectShiftOverlap(candidate, [other])).toEqual(other);
  });

  it("treats adjacent shifts (end == start) as not overlapping", () => {
    const middle = isoHoursAgo(4);
    const candidate = { start: isoHoursAgo(6), end: middle };
    const other = shift(middle, isoHoursAgo(2));
    expect(detectShiftOverlap(candidate, [other])).toBeNull();
  });

  it("excludes the shift named in excludeShiftId", () => {
    const candidate = {
      start: isoHoursAgo(4),
      end: isoHoursAgo(2),
      excludeShiftId: VALID_UUID_A,
    };
    const self = shift(isoHoursAgo(4), isoHoursAgo(2), VALID_UUID_A);
    expect(detectShiftOverlap(candidate, [self])).toBeNull();
  });

  it("ignores shifts with end_time = null (active shifts)", () => {
    const candidate = { start: isoHoursAgo(4), end: isoHoursAgo(2) };
    const active: ShiftForResolve = {
      id: VALID_UUID_A,
      trainer_id: VALID_UUID_B,
      start_time: isoHoursAgo(5),
      end_time: null,
      shift_period: "regular",
    };
    expect(detectShiftOverlap(candidate, [active])).toBeNull();
  });
});

describe("formatRequestSummary", () => {
  it("formats a retro_add summary in Hebrew", () => {
    const summary = formatRequestSummary({
      request_type: "retro_add",
      requested_start_time: "2026-03-14T12:00:00.000Z",
      requested_end_time: "2026-03-14T16:00:00.000Z",
    });
    expect(summary).toContain("הוספת משמרת");
  });

  it("formats an edit summary in Hebrew", () => {
    const summary = formatRequestSummary({
      request_type: "edit",
      requested_start_time: "2026-03-14T12:00:00.000Z",
      requested_end_time: "2026-03-14T16:00:00.000Z",
    });
    expect(summary).toContain("עריכת משמרת");
  });

  it("marks a morning request in the summary", () => {
    const summary = formatRequestSummary({
      request_type: "retro_add",
      requested_start_time: IL_0800,
      requested_end_time: IL_1100,
      shift_period: "morning",
    });
    expect(summary).toContain("הוספת משמרת בוקר");
  });

  it("leaves a regular request summary unqualified", () => {
    const summary = formatRequestSummary({
      request_type: "retro_add",
      requested_start_time: IL_1100,
      requested_end_time: IL_1600,
      shift_period: "regular",
    });
    expect(summary).toContain("הוספת משמרת ");
    expect(summary).not.toContain("בוקר");
  });
});
