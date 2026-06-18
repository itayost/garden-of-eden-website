-- ===========================================
-- TRAINEE COMMUNICATION LOG (הסטוריית תקשורת)
-- Free-text, append-style notes logged by staff about a trainee.
-- Each note records who wrote it (author snapshot) and when.
-- Distinct from trainer_shift_reports (structured shift observations).
-- ===========================================

CREATE TABLE trainee_communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  author_id UUID NOT NULL REFERENCES profiles(id),
  -- Denormalized snapshot so the log survives author renames/deletions.
  author_name TEXT NOT NULL,

  content TEXT NOT NULL CHECK (content <> ''),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_trainee_communication_log_trainee_created
  ON trainee_communication_log(trainee_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ===========================================
-- ROW LEVEL SECURITY (staff-only; trainees get no SELECT policy)
-- ===========================================
ALTER TABLE trainee_communication_log ENABLE ROW LEVEL SECURITY;

-- Admins and trainers can view all notes.
CREATE POLICY "Admins and trainers can view communication log" ON trainee_communication_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- Admins and trainers can insert notes authored by themselves.
-- WITH CHECK binds author_id to the caller so a note cannot be forged under
-- another user's identity via a direct API call. The role check also blocks
-- soft-deleted (offboarded) staff from retaining write access.
CREATE POLICY "Admins and trainers can insert communication log" ON trainee_communication_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- A note's author, or any admin, can update it (covers the soft-delete write).
-- Enforces author-or-admin authorization at the data layer, mirroring
-- deleteCommunicationNote so the rule cannot be bypassed by a direct API call.
CREATE POLICY "Author or admin can update communication log" ON trainee_communication_log
  FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- Hard DELETE is blocked. The app soft-deletes via UPDATE only.
CREATE POLICY "No hard delete communication log" ON trainee_communication_log
  FOR DELETE
  TO authenticated
  USING (false);
