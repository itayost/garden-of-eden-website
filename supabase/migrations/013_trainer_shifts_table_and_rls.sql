-- Trainer Shifts Table and RLS Policies
-- Tracks trainer clock-in/clock-out times
-- The table may already exist (created directly in Supabase), so using IF NOT EXISTS

CREATE TABLE IF NOT EXISTS trainer_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_name TEXT NOT NULL,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  auto_ended BOOLEAN DEFAULT false,
  flagged_for_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS trainer_shifts_trainer_id_idx
  ON trainer_shifts(trainer_id);

CREATE INDEX IF NOT EXISTS trainer_shifts_start_time_idx
  ON trainer_shifts(start_time DESC);

-- Unique partial index: only one active shift per trainer (prevents race condition duplicates)
DROP INDEX IF EXISTS trainer_shifts_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS trainer_shifts_active_unique_idx
  ON trainer_shifts(trainer_id)
  WHERE end_time IS NULL;

-- Updated at trigger (with search_path security)
CREATE OR REPLACE FUNCTION update_trainer_shift_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trainer_shift_updated_at'
  ) THEN
    CREATE TRIGGER trainer_shift_updated_at
      BEFORE UPDATE ON trainer_shifts
      FOR EACH ROW
      EXECUTE FUNCTION update_trainer_shift_updated_at();
  END IF;
END;
$$;

-- RLS
ALTER TABLE trainer_shifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency (safe re-run)
DROP POLICY IF EXISTS "Trainers can insert own shifts" ON trainer_shifts;
DROP POLICY IF EXISTS "Trainers can update own shifts" ON trainer_shifts;
DROP POLICY IF EXISTS "Trainers can view own shifts" ON trainer_shifts;
DROP POLICY IF EXISTS "Admins can view all shifts" ON trainer_shifts;
DROP POLICY IF EXISTS "Admins can update all shifts" ON trainer_shifts;
DROP POLICY IF EXISTS "Admins can delete shifts" ON trainer_shifts;

-- Trainers can insert their own shifts (clock in)
CREATE POLICY "Trainers can insert own shifts"
  ON trainer_shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('trainer', 'admin')
    )
  );

-- Trainers can update their own shifts (clock out)
CREATE POLICY "Trainers can update own shifts"
  ON trainer_shifts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('trainer', 'admin')
    )
  )
  WITH CHECK (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('trainer', 'admin')
    )
  );

-- Trainers can view their own shifts
CREATE POLICY "Trainers can view own shifts"
  ON trainer_shifts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('trainer', 'admin')
    )
  );

-- Admins can view all shifts
CREATE POLICY "Admins can view all shifts"
  ON trainer_shifts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Admins can update all shifts (end shift, mark reviewed)
CREATE POLICY "Admins can update all shifts"
  ON trainer_shifts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Admins can delete shifts
CREATE POLICY "Admins can delete shifts"
  ON trainer_shifts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
