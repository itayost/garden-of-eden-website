-- Loosen retention_notes RLS so any admin/trainer can update/delete any note.
-- Original policies restricted UPDATE/DELETE to the row author (or admin only),
-- which blocked collaborative editing and produced 42501 RLS violations.

DROP POLICY IF EXISTS "Authors and admins can update retention notes" ON retention_notes;
DROP POLICY IF EXISTS "Authors and admins can delete retention notes" ON retention_notes;

CREATE POLICY "Admin and trainers can update retention notes"
  ON retention_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

CREATE POLICY "Admin and trainers can delete retention notes"
  ON retention_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );
