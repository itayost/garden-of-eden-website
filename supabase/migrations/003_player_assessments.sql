-- Player Assessments Tables for physical test tracking
-- Run this in Supabase SQL Editor

-- ===========================================
-- ADD BIRTHDATE TO PROFILES
-- ===========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate DATE;

-- ===========================================
-- PLAYER ASSESSMENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS player_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_date DATE DEFAULT CURRENT_DATE,

  -- Sprint tests (seconds, lower is better) - ALL OPTIONAL
  sprint_5m DECIMAL(5,3),
  sprint_10m DECIMAL(5,3),
  sprint_20m DECIMAL(5,3),

  -- Jump tests (cm, higher is better)
  jump_2leg_distance DECIMAL(5,1),
  jump_right_leg DECIMAL(5,1),
  jump_left_leg DECIMAL(5,1),
  jump_2leg_height DECIMAL(5,1),

  -- Agility/reaction (seconds, lower is better)
  blaze_spot_time DECIMAL(5,2),

  -- Flexibility (cm per joint, higher is better)
  flexibility_ankle DECIMAL(4,1),
  flexibility_knee DECIMAL(4,1),
  flexibility_hip DECIMAL(4,1),

  -- Categorical assessments
  coordination TEXT CHECK (coordination IS NULL OR coordination IN ('basic', 'advanced', 'deficient')),
  leg_power_technique TEXT CHECK (leg_power_technique IS NULL OR leg_power_technique IN ('normal', 'deficient')),
  body_structure TEXT CHECK (body_structure IS NULL OR body_structure IN ('thin_weak', 'good_build', 'strong_athletic')),

  -- Kick power (percentage, higher is better)
  kick_power_kaiser DECIMAL(5,2),

  -- Mental notes (free text)
  concentration_notes TEXT,
  decision_making_notes TEXT,
  work_ethic_notes TEXT,
  recovery_notes TEXT,
  nutrition_notes TEXT,

  -- Metadata
  assessed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_assessments_user_date ON player_assessments(user_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_created ON player_assessments(created_at DESC);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE player_assessments ENABLE ROW LEVEL SECURITY;

-- Users can view their own assessments
CREATE POLICY "Users can view own assessments" ON player_assessments
  FOR SELECT USING (auth.uid() = user_id);

-- Admins and trainers can view all assessments
CREATE POLICY "Admins can view all assessments" ON player_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can insert assessments
CREATE POLICY "Admins can insert assessments" ON player_assessments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can update assessments
CREATE POLICY "Admins can update assessments" ON player_assessments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins can delete assessments
CREATE POLICY "Admins can delete assessments" ON player_assessments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
