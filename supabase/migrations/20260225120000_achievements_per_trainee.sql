-- Add per-trainee achievement data (details + categories per player)
-- Replaces the single achievements_details text field for new reports.
-- Old reports continue using achievements_details for backward compatibility.

ALTER TABLE trainer_shift_reports
  ADD COLUMN IF NOT EXISTS achievements_per_trainee JSONB DEFAULT '{}';

COMMENT ON COLUMN trainer_shift_reports.achievements_per_trainee IS
  'Per-trainee achievement data: { "trainee_id": { "details": "text", "categories": ["cat1", "cat2"] } }';
