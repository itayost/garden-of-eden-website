-- Allow admins to update any trainer shift report
-- (Trainers can already update their own reports via existing policy)
CREATE POLICY "Admins can update any shift report"
  ON trainer_shift_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
