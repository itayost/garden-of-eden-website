-- Add "worked on today" fields to trainer_shift_reports
-- Per-trainee categories + free text describing what the trainer focused on
-- with specific trainees during the shift.

ALTER TABLE trainer_shift_reports
  ADD COLUMN IF NOT EXISTS has_worked_on_focus BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS worked_on_trainee_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worked_on_details TEXT,
  ADD COLUMN IF NOT EXISTS worked_on_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb;
