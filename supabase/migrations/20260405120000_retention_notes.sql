-- Retention notes: per-report, per-trainee free-text notes
CREATE TABLE retention_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month   date NOT NULL,
  trainee_phone  text NOT NULL,
  trainee_name   text NOT NULL,
  note           text NOT NULL,
  author_id      uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_month, trainee_phone)
);

CREATE INDEX idx_retention_notes_month ON retention_notes(report_month);

-- RLS
ALTER TABLE retention_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer
CREATE POLICY "Admin and trainers can read retention notes"
  ON retention_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT: admin and trainer
CREATE POLICY "Admin and trainers can create retention notes"
  ON retention_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND author_id = auth.uid()
  );

-- UPDATE: author can edit own, admin can edit any
CREATE POLICY "Authors and admins can update retention notes"
  ON retention_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
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

-- DELETE: author can delete own, admin can delete any (for empty-note cleanup)
CREATE POLICY "Authors and admins can delete retention notes"
  ON retention_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  );
