-- Per-trainee details (no categories) for the remaining shift-report sections
-- that previously used a single textarea + multi-select.
-- Old reports keep using `<section>_details` and `<section>_trainee_ids` for
-- backward compatibility; new reports populate the JSONB and set the legacy
-- text column to NULL.

ALTER TABLE trainer_shift_reports
  ADD COLUMN IF NOT EXISTS new_trainees_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS discipline_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS injuries_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS limitations_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mental_state_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS complaints_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS insufficient_attention_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pro_candidates_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS social_skills_per_trainee JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN trainer_shift_reports.new_trainees_per_trainee IS
  'Per-trainee details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.discipline_per_trainee IS
  'Per-trainee discipline issue details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.injuries_per_trainee IS
  'Per-trainee injury details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.limitations_per_trainee IS
  'Per-trainee physical limitations details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.mental_state_per_trainee IS
  'Per-trainee mental state details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.complaints_per_trainee IS
  'Per-trainee complaint details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.insufficient_attention_per_trainee IS
  'Per-trainee insufficient-attention details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.pro_candidates_per_trainee IS
  'Per-trainee PRO upgrade candidate details: { "trainee_id": { "details": "text" } }';
COMMENT ON COLUMN trainer_shift_reports.social_skills_per_trainee IS
  'Per-trainee social skills details: { "trainee_id": { "details": "text" } }';
