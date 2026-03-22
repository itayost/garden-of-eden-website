-- Retention report monthly snapshots
CREATE TABLE retention_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month  date NOT NULL UNIQUE,
  data          jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retention_reports_month ON retention_reports (report_month DESC);

-- RLS
ALTER TABLE retention_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer only
CREATE POLICY "Admin and trainers can read retention reports"
  ON retention_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT/UPDATE/DELETE: service role only (no user policy = denied for anon/authenticated)
