-- Table for tracking failed/expired shift sync attempts
-- Admin is notified about these so they can manually correct payroll

CREATE TABLE IF NOT EXISTS failed_shift_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('clock_in', 'clock_out')),
  client_timestamp TEXT NOT NULL,
  failure_reason TEXT NOT NULL DEFAULT 'expired',
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS failed_shift_syncs_resolved_idx
  ON failed_shift_syncs(resolved)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS failed_shift_syncs_created_at_idx
  ON failed_shift_syncs(created_at DESC);

-- RLS
ALTER TABLE failed_shift_syncs ENABLE ROW LEVEL SECURITY;

-- Trainers can insert their own failed syncs (via API route)
CREATE POLICY "Trainers can insert own failed syncs"
  ON failed_shift_syncs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('trainer', 'admin')
    )
  );

-- Admins can view all failed syncs
CREATE POLICY "Admins can view all failed syncs"
  ON failed_shift_syncs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Admins can update (resolve) failed syncs
CREATE POLICY "Admins can update failed syncs"
  ON failed_shift_syncs
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

-- Admins can delete failed syncs
CREATE POLICY "Admins can delete failed syncs"
  ON failed_shift_syncs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
