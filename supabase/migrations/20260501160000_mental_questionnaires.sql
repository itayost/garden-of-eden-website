CREATE TABLE mental_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  last_session_conclusion TEXT,
  mental_insight TEXT,
  tool_to_take TEXT,
  wants_more_zoom BOOLEAN,
  zoom_feeling TEXT,
  wants_one_on_one BOOLEAN,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mental_questionnaires_user ON mental_questionnaires(user_id);
CREATE INDEX idx_mental_questionnaires_date ON mental_questionnaires(submitted_at);

ALTER TABLE mental_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mental questionnaires" ON mental_questionnaires
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mental questionnaires" ON mental_questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all mental questionnaires" ON mental_questionnaires
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );
