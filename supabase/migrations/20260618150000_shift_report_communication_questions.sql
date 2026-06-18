-- Three new per-trainee questions at the end of the shift report:
--   homework        — homework message sent to a player (topic/exercise)
--   video_feedback  — positive video feedback sent to a player's parents
--   praise          — character/conduct/persistence praise sent to a trainee
-- Same details-only per-trainee pattern as discipline/mental_state etc.:
-- has_<k> flag + <k>_trainee_ids uuid[] + legacy <k>_details + <k>_per_trainee JSONB.

ALTER TABLE trainer_shift_reports
  ADD COLUMN IF NOT EXISTS has_homework boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homework_trainee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS homework_details text,
  ADD COLUMN IF NOT EXISTS homework_per_trainee jsonb NOT NULL DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS has_video_feedback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_feedback_trainee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_feedback_details text,
  ADD COLUMN IF NOT EXISTS video_feedback_per_trainee jsonb NOT NULL DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS has_praise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS praise_trainee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS praise_details text,
  ADD COLUMN IF NOT EXISTS praise_per_trainee jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN trainer_shift_reports.homework_per_trainee IS
  'Per-trainee homework message: { "trainee_id": { "details": "topic/exercise sent" } }';
COMMENT ON COLUMN trainer_shift_reports.video_feedback_per_trainee IS
  'Per-trainee positive video feedback to parents: { "trainee_id": { "details": "exercise performed" } }';
COMMENT ON COLUMN trainer_shift_reports.praise_per_trainee IS
  'Per-trainee character/persistence praise: { "trainee_id": { "details": "praise content" } }';
