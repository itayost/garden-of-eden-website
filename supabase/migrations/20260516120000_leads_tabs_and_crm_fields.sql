-- Leads: add source (paid vs organic) + CRM-style fields
-- Adds: source, club, birth_year, additional_info, assigned_trainer_id
-- Backfills club from flow_team where present
-- Adds composite index on (source, created_at) and partial index on assigned_trainer_id

ALTER TABLE leads
  ADD COLUMN source TEXT NOT NULL DEFAULT 'paid'
    CHECK (source IN ('paid', 'organic'));

ALTER TABLE leads
  ADD COLUMN club TEXT,
  ADD COLUMN birth_year INTEGER,
  ADD COLUMN additional_info TEXT,
  ADD COLUMN assigned_trainer_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD CONSTRAINT leads_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year BETWEEN 1990 AND 2030));

UPDATE leads
SET club = flow_team
WHERE club IS NULL AND flow_team IS NOT NULL;

CREATE INDEX leads_source_created_idx
  ON leads (source, created_at DESC);

CREATE INDEX leads_assigned_trainer_idx
  ON leads (assigned_trainer_id)
  WHERE assigned_trainer_id IS NOT NULL;
