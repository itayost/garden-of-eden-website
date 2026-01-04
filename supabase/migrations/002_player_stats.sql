-- Player Stats Tables for EA FC-style player cards
-- Run this in Supabase SQL Editor after schema.sql

-- ===========================================
-- PLAYER STATS TABLE
-- ===========================================
CREATE TABLE player_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Player Card Display Info
  position VARCHAR(3) DEFAULT 'CM',
  card_type VARCHAR(20) DEFAULT 'gold',

  -- Main EA FC Stats (0-99)
  overall_rating INTEGER DEFAULT 50,
  pace INTEGER DEFAULT 50,
  shooting INTEGER DEFAULT 50,
  passing INTEGER DEFAULT 50,
  dribbling INTEGER DEFAULT 50,
  defending INTEGER DEFAULT 50,
  physical INTEGER DEFAULT 50,

  -- PACE Sub-stats (Athletic Pillar)
  acceleration INTEGER DEFAULT 50,
  sprint_speed INTEGER DEFAULT 50,
  agility INTEGER DEFAULT 50,

  -- SHOOTING Sub-stats (Technical-Tactical Pillar)
  finishing INTEGER DEFAULT 50,
  shot_power INTEGER DEFAULT 50,
  long_shots INTEGER DEFAULT 50,
  positioning INTEGER DEFAULT 50,

  -- PASSING Sub-stats (Technical-Tactical Pillar)
  vision INTEGER DEFAULT 50,
  short_passing INTEGER DEFAULT 50,
  long_passing INTEGER DEFAULT 50,
  crossing INTEGER DEFAULT 50,

  -- DRIBBLING Sub-stats (Technical-Tactical + Mental Pillar)
  ball_control INTEGER DEFAULT 50,
  dribbling_skill INTEGER DEFAULT 50,
  composure INTEGER DEFAULT 50,
  reactions INTEGER DEFAULT 50,

  -- DEFENDING Sub-stats (Technical-Tactical Pillar)
  interceptions INTEGER DEFAULT 50,
  tackling INTEGER DEFAULT 50,
  marking INTEGER DEFAULT 50,
  heading_accuracy INTEGER DEFAULT 50,

  -- PHYSICAL Sub-stats (Athletic + Lifestyle Pillars)
  stamina INTEGER DEFAULT 50,
  strength INTEGER DEFAULT 50,
  jumping INTEGER DEFAULT 50,
  balance INTEGER DEFAULT 50,

  -- Additional Training Metrics (Mental + Lifestyle Pillars)
  focus INTEGER DEFAULT 50,
  decision_making INTEGER DEFAULT 50,
  work_rate INTEGER DEFAULT 50,
  recovery INTEGER DEFAULT 50,
  nutrition_score INTEGER DEFAULT 50,

  -- Metadata
  last_updated_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one stats record per user
CREATE UNIQUE INDEX idx_player_stats_user_id ON player_stats(user_id);

-- Index for admin queries
CREATE INDEX idx_player_stats_updated_at ON player_stats(updated_at);

-- ===========================================
-- PLAYER STATS HISTORY TABLE
-- ===========================================
CREATE TABLE player_stats_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_stats_id UUID NOT NULL REFERENCES player_stats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Snapshot of main stats at this point
  overall_rating INTEGER,
  pace INTEGER,
  shooting INTEGER,
  passing INTEGER,
  dribbling INTEGER,
  defending INTEGER,
  physical INTEGER,

  -- Who made the change
  updated_by UUID REFERENCES profiles(id),
  update_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying user history
CREATE INDEX idx_player_stats_history_user ON player_stats_history(user_id);
CREATE INDEX idx_player_stats_history_date ON player_stats_history(created_at);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view own stats" ON player_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Admins and trainers can view all stats
CREATE POLICY "Admins can view all stats" ON player_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can insert stats
CREATE POLICY "Admins can insert stats" ON player_stats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can update stats
CREATE POLICY "Admins can update stats" ON player_stats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins can delete stats
CREATE POLICY "Admins can delete stats" ON player_stats
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- History policies
CREATE POLICY "Users can view own history" ON player_stats_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all history" ON player_stats_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

CREATE POLICY "Admins can insert history" ON player_stats_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- ===========================================
-- UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_player_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_player_stats_updated_at();
