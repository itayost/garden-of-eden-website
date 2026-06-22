-- Trainer shifts: record a single categorised "other purposes" time entry
-- (e.g. nutrition, customer retention) so admins can see training time
-- separately from non-training time.

ALTER TABLE trainer_shifts
  ADD COLUMN IF NOT EXISTS other_purpose_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_purpose_category text;

ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_minutes_nonneg
    CHECK (other_purpose_minutes >= 0);

ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_category_valid
    CHECK (other_purpose_category IS NULL OR other_purpose_category IN (
      'תזונה',
      'שימור לקוחות',
      'ישיבות / פגישות צוות',
      'אדמיניסטרציה (ניירת)',
      'שיווק ותוכן',
      'תחזוקת מתקן'
    ));

-- Single-entry semantics: both set together or both empty.
ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_paired
    CHECK (
      (other_purpose_minutes > 0 AND other_purpose_category IS NOT NULL)
      OR (other_purpose_minutes = 0 AND other_purpose_category IS NULL)
    );
