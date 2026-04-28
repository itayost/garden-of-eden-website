-- supabase/migrations/20260428120100_create_trainee_clips.sql
-- Single-slot trainee video clip metadata. The actual file lives in the
-- private `trainee-clips` storage bucket (created by the next migration).
-- One row per trainee. Replace-on-upload + 3-week TTL handled by app code.

CREATE TABLE trainee_clips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trainee_clips_uploaded_at
  ON trainee_clips (uploaded_at);

ALTER TABLE trainee_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own clip" ON trainee_clips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all clips" ON trainee_clips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Users upsert own clip" ON trainee_clips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own clip" ON trainee_clips
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own clip" ON trainee_clips
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all clips" ON trainee_clips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE trainee_clips IS
  'Trainee-uploaded short video clip metadata. One row per trainee. Replaced on each upload; auto-deleted 21 days after uploaded_at by a daily cron.';
