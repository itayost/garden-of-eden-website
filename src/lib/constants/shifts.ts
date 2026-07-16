export const MAX_SHIFT_HOURS = 12;

// Morning shifts are bounded to 08:00-11:00 Israel time. Mirrored in the
// approve_shift_change_request RPC, which cannot import from here.
export const MORNING_SHIFT_START_HOUR = 8;
export const MORNING_SHIFT_END_HOUR = 11;

export const SHIFT_PERIODS = ["morning", "regular"] as const;

export type ShiftPeriod = (typeof SHIFT_PERIODS)[number];

export const SHIFT_PERIOD_LABELS: Record<ShiftPeriod, string> = {
  morning: "משמרת בוקר",
  regular: "משמרת רגילה",
};

export const SHIFT_OTHER_PURPOSE_CATEGORIES = [
  "תזונה",
  "שימור לקוחות",
  "ישיבות / פגישות צוות",
  "אדמיניסטרציה (ניירת)",
  "שיווק ותוכן",
  "תחזוקת מתקן",
] as const;

export type ShiftOtherPurposeCategory =
  (typeof SHIFT_OTHER_PURPOSE_CATEGORIES)[number];
