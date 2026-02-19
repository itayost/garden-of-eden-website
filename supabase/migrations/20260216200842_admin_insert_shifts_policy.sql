-- Allow admins to create shifts on behalf of any trainer
-- Required by adminCreateShiftAction (admin creates shift where trainer_id != auth.uid())

DROP POLICY IF EXISTS "Admins can insert shifts for any trainer" ON trainer_shifts;

CREATE POLICY "Admins can insert shifts for any trainer"
  ON trainer_shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
