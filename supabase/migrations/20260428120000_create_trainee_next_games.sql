-- supabase/migrations/20260428120000_create_trainee_next_games.sql
-- Trainee-declared next-game intent. One row per trainee. Auto-cleared by a
-- daily cron that deletes rows whose game_date has passed (Asia/Jerusalem),
-- which naturally satisfies the "resets at start of week" requirement and
-- removes already-played games.

CREATE TABLE trainee_next_games (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  game_date   DATE NOT NULL,
  opponent    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trainee_next_games_game_date
  ON trainee_next_games (game_date);

ALTER TABLE trainee_next_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own next game" ON trainee_next_games
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all next games" ON trainee_next_games
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Users upsert own next game" ON trainee_next_games
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own next game" ON trainee_next_games
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own next game" ON trainee_next_games
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all next games" ON trainee_next_games
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION trainee_next_games_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trainee_next_games_updated_at
  BEFORE UPDATE ON trainee_next_games
  FOR EACH ROW
  EXECUTE FUNCTION trainee_next_games_set_updated_at();

COMMENT ON TABLE trainee_next_games IS
  'Trainee-declared next football game. One row per trainee. Cleared daily once game_date < today (Asia/Jerusalem).';
