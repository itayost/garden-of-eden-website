-- supabase/migrations/20260425120000_create_player_rating_snapshots.sql
-- Frozen card-stat history. One row per assessment (live or soft-deleted),
-- keyed on assessment_id. The partial index on user_id+assessment_date
-- excludes soft-deleted snapshots since reads always filter them out.

CREATE TABLE player_rating_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES player_assessments(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  age_group       TEXT,

  pace            INTEGER,
  shooting        INTEGER,
  passing         INTEGER,
  dribbling       INTEGER,
  defending       INTEGER,
  physical        INTEGER,
  overall_rating  INTEGER,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT player_rating_snapshots_assessment_id_unique UNIQUE (assessment_id)
);

CREATE INDEX idx_player_rating_snapshots_user_date
  ON player_rating_snapshots (user_id, assessment_date DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE player_rating_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rating snapshots" ON player_rating_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all rating snapshots" ON player_rating_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

COMMENT ON TABLE player_rating_snapshots IS
  'Frozen card-stat ratings, computed at assessment write time. One row per assessment, keyed on assessment_id. Stable history: never recomputed on read.';
