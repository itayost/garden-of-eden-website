-- Retention notes: add per-month assigned trainer + auto-updating updated_at.
--
-- The retention table needs a "מאמן משוייך" column (manual per-month trainer
-- assignment, stored alongside the note) and a "תאריך עדכון אחרון" column.
-- retention_notes.updated_at already exists but was only set in code; make it
-- auto-update on every write via the shared trigger convention.

-- 1. Ensure the shared updated_at trigger function exists (idempotent).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Per-month assigned trainer (nullable; cleared if the trainer profile is removed).
ALTER TABLE retention_notes
  ADD COLUMN IF NOT EXISTS assigned_trainer_id uuid
    REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Allow trainer-only rows (no note text yet) — note is NOT NULL with no default.
ALTER TABLE retention_notes ALTER COLUMN note SET DEFAULT '';

-- 4. Auto-update updated_at on every UPDATE (matches leads / lead_tabs convention).
DROP TRIGGER IF EXISTS set_retention_notes_updated_at ON retention_notes;
CREATE TRIGGER set_retention_notes_updated_at
  BEFORE UPDATE ON retention_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
