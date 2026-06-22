-- Churned customers ("לקוחות שעזבו"): add per-record assigned trainer +
-- auto-updating updated_at, mirroring the retention_notes columns added in
-- 20260618144659_retention_notes_trainer_and_updated_at.sql.
--
-- The churned tab needs a "מאמן משוייך" column (manual trainer assignment) and
-- a "תאריך עדכון אחרון" column that updates automatically on every edit.

-- update_updated_at_column() already exists (created idempotently in the
-- retention_notes migration); re-assert it so this migration is self-contained.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Per-record assigned trainer (nullable; cleared if the trainer profile is removed).
ALTER TABLE churned_customers
  ADD COLUMN IF NOT EXISTS assigned_trainer_id uuid
    REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Auto-update updated_at on every UPDATE (matches retention_notes / leads convention).
DROP TRIGGER IF EXISTS set_churned_customers_updated_at ON churned_customers;
CREATE TRIGGER set_churned_customers_updated_at
  BEFORE UPDATE ON churned_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
