-- Add club field to profiles
ALTER TABLE profiles ADD COLUMN club TEXT NULL;

-- Add social skills columns to trainer_shift_reports
ALTER TABLE trainer_shift_reports
  ADD COLUMN has_social_skills BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN social_skills_trainee_ids UUID[] DEFAULT '{}',
  ADD COLUMN social_skills_details TEXT;

-- Create trainee_summaries table
CREATE TABLE trainee_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainee_summaries_user_id ON trainee_summaries(user_id);

-- Auto-update updated_at
CREATE TRIGGER set_trainee_summaries_updated_at
  BEFORE UPDATE ON trainee_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE trainee_summaries ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admins_full_access_trainee_summaries"
  ON trainee_summaries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trainers: read all summaries
CREATE POLICY "trainers_select_trainee_summaries"
  ON trainee_summaries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainers: insert own authored summaries
CREATE POLICY "trainers_insert_trainee_summaries"
  ON trainee_summaries FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainers: update own authored summaries
CREATE POLICY "trainers_update_trainee_summaries"
  ON trainee_summaries FOR UPDATE
  USING (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  )
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainers: delete own authored summaries
CREATE POLICY "trainers_delete_own_trainee_summaries"
  ON trainee_summaries FOR DELETE
  USING (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainees: read their own summaries
CREATE POLICY "trainees_select_own_summaries"
  ON trainee_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- Index on author_id for RLS and query performance
CREATE INDEX idx_trainee_summaries_author_id ON trainee_summaries(author_id);
