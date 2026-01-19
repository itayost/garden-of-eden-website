-- =====================================================
-- Migration 007: Goals System
-- Trainer-managed goals for physical metrics
-- Automatic achievement detection via triggers
-- =====================================================

-- =====================================================
-- 1. CREATE player_goals TABLE
-- =====================================================
CREATE TABLE player_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Metric being tracked (must match PhysicalMetricKey)
  metric_key TEXT NOT NULL CHECK (
    metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_kaiser'
    )
  ),

  -- Goal target value
  target_value DECIMAL(10,3) NOT NULL CHECK (target_value > 0),

  -- Baseline value when goal was set (for progress calculation)
  baseline_value DECIMAL(10,3),

  -- Current best value toward goal
  current_value DECIMAL(10,3),

  -- Whether lower is better (true for sprint times, agility)
  is_lower_better BOOLEAN DEFAULT FALSE NOT NULL,

  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- When goal was achieved (NULL if not yet achieved)
  achieved_at TIMESTAMPTZ,
  achieved_value DECIMAL(10,3)
);

-- Create partial unique index for one active goal per metric per user
CREATE UNIQUE INDEX idx_player_goals_unique_active
  ON player_goals(user_id, metric_key)
  WHERE achieved_at IS NULL;

-- Indexes for performance
CREATE INDEX idx_player_goals_user_id ON player_goals(user_id);
CREATE INDEX idx_player_goals_active ON player_goals(user_id) WHERE achieved_at IS NULL;
CREATE INDEX idx_player_goals_achieved ON player_goals(user_id, achieved_at) WHERE achieved_at IS NOT NULL;

-- =====================================================
-- 2. HELPER FUNCTION: Check if goal is achieved
-- =====================================================
CREATE OR REPLACE FUNCTION is_goal_achieved(
  p_current_value DECIMAL,
  p_target_value DECIMAL,
  p_is_lower_better BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_current_value IS NULL OR p_target_value IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_is_lower_better THEN
    -- For sprint times, lower is better (e.g., target 1.2s, achieved 1.1s)
    RETURN p_current_value <= p_target_value;
  ELSE
    -- For jumps, flexibility, power - higher is better
    RETURN p_current_value >= p_target_value;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. TRIGGER FUNCTION: Check goals after assessment
-- =====================================================
CREATE OR REPLACE FUNCTION check_goal_achievements_after_assessment()
RETURNS TRIGGER AS $$
DECLARE
  goal_record RECORD;
  metric_value DECIMAL;
  goal_achieved BOOLEAN;
  is_improvement BOOLEAN;
BEGIN
  -- For each active goal for this user
  FOR goal_record IN
    SELECT * FROM player_goals
    WHERE user_id = NEW.user_id
    AND achieved_at IS NULL
    FOR UPDATE
  LOOP
    -- Get the metric value from the new assessment
    metric_value := NULL;
    CASE goal_record.metric_key
      WHEN 'sprint_5m' THEN metric_value := NEW.sprint_5m;
      WHEN 'sprint_10m' THEN metric_value := NEW.sprint_10m;
      WHEN 'sprint_20m' THEN metric_value := NEW.sprint_20m;
      WHEN 'jump_2leg_distance' THEN metric_value := NEW.jump_2leg_distance;
      WHEN 'jump_2leg_height' THEN metric_value := NEW.jump_2leg_height;
      WHEN 'jump_right_leg' THEN metric_value := NEW.jump_right_leg;
      WHEN 'jump_left_leg' THEN metric_value := NEW.jump_left_leg;
      WHEN 'blaze_spot_time' THEN metric_value := NEW.blaze_spot_time;
      WHEN 'flexibility_ankle' THEN metric_value := NEW.flexibility_ankle;
      WHEN 'flexibility_knee' THEN metric_value := NEW.flexibility_knee;
      WHEN 'flexibility_hip' THEN metric_value := NEW.flexibility_hip;
      WHEN 'kick_power_kaiser' THEN metric_value := NEW.kick_power_kaiser;
    END CASE;

    -- Skip if this metric wasn't recorded in this assessment
    IF metric_value IS NULL THEN
      CONTINUE;
    END IF;

    -- Check if this is an improvement
    is_improvement := FALSE;
    IF goal_record.current_value IS NULL THEN
      -- First measurement
      is_improvement := TRUE;
    ELSIF goal_record.is_lower_better AND metric_value < goal_record.current_value THEN
      -- Improvement for lower-is-better metrics
      is_improvement := TRUE;
    ELSIF NOT goal_record.is_lower_better AND metric_value > goal_record.current_value THEN
      -- Improvement for higher-is-better metrics
      is_improvement := TRUE;
    END IF;

    -- Update current_value if this is an improvement
    IF is_improvement THEN
      UPDATE player_goals
      SET current_value = metric_value, updated_at = NOW()
      WHERE id = goal_record.id;
    END IF;

    -- Check if goal is now achieved
    goal_achieved := is_goal_achieved(
      metric_value,
      goal_record.target_value,
      goal_record.is_lower_better
    );

    IF goal_achieved THEN
      UPDATE player_goals
      SET
        achieved_at = NOW(),
        achieved_value = metric_value,
        current_value = metric_value,
        updated_at = NOW()
      WHERE id = goal_record.id;
    END IF;

  END LOOP;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Goal achievement check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE TRIGGERS ON player_assessments
-- =====================================================
CREATE TRIGGER goals_after_assessment_insert
  AFTER INSERT ON player_assessments
  FOR EACH ROW
  EXECUTE FUNCTION check_goal_achievements_after_assessment();

CREATE TRIGGER goals_after_assessment_update
  AFTER UPDATE ON player_assessments
  FOR EACH ROW
  EXECUTE FUNCTION check_goal_achievements_after_assessment();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE player_goals ENABLE ROW LEVEL SECURITY;

-- Users can view their own goals
CREATE POLICY "Users can view own goals" ON player_goals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Trainers and admins can view all goals
CREATE POLICY "Trainers can view all goals" ON player_goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only trainers and admins can create goals
CREATE POLICY "Trainers can create goals" ON player_goals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only trainers and admins can update goals
CREATE POLICY "Trainers can update goals" ON player_goals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only trainers and admins can delete goals
CREATE POLICY "Trainers can delete goals" ON player_goals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE player_goals IS 'Trainer-managed performance goals for players';
COMMENT ON COLUMN player_goals.metric_key IS 'Physical metric being tracked (matches PhysicalMetricKey type)';
COMMENT ON COLUMN player_goals.is_lower_better IS 'True for sprint/agility times, false for jumps/flexibility/power';
COMMENT ON COLUMN player_goals.baseline_value IS 'Starting value when goal was set (for progress percentage)';
COMMENT ON COLUMN player_goals.current_value IS 'Best value achieved so far toward goal';
