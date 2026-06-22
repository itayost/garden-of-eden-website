export const MAX_SHIFT_HOURS = 12;

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
