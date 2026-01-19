-- =====================================================
-- Migration 006: Streak Tracking
-- Track consecutive weekday activities (Mon-Fri)
-- Automatic updates via database triggers
-- =====================================================

-- =====================================================
-- 1. CREATE user_streaks TABLE
-- =====================================================
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for leaderboards (future feature)
CREATE INDEX idx_user_streaks_current ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_longest ON user_streaks(longest_streak DESC);

-- =====================================================
-- 2. HELPER FUNCTION: Check if weekday in Israel timezone
-- =====================================================
CREATE OR REPLACE FUNCTION is_weekday_israel(check_timestamp TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
  day_of_week INTEGER;
BEGIN
  -- Convert to Israel timezone and get day of week (0=Sunday, 6=Saturday)
  day_of_week := EXTRACT(DOW FROM check_timestamp AT TIME ZONE 'Asia/Jerusalem');
  -- Return true if Mon(1) through Fri(5)
  RETURN day_of_week BETWEEN 1 AND 5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. HELPER FUNCTION: Count weekdays MISSED between two dates
-- Counts weekdays between dates, excluding both endpoints
-- Example: Friday→Tuesday returns 1 (only Monday was missed)
-- =====================================================
CREATE OR REPLACE FUNCTION count_weekdays_missed(last_activity DATE, current_activity DATE)
RETURNS INTEGER AS $$
DECLARE
  weekday_count INTEGER;
BEGIN
  -- Same day or invalid range
  IF last_activity >= current_activity THEN
    RETURN 0;
  END IF;

  -- Adjacent days (e.g., Monday→Tuesday)
  IF current_activity = last_activity + 1 THEN
    RETURN 0;
  END IF;

  -- Count weekdays between (exclusive of both endpoints)
  -- From day after last_activity to day before current_activity
  SELECT COUNT(*)
  INTO weekday_count
  FROM generate_series(last_activity + 1, current_activity - 1, '1 day'::INTERVAL) AS d
  WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5;

  RETURN weekday_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. CORE STREAK UPDATE FUNCTION
-- Uses FOR UPDATE to prevent race conditions
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID, p_activity_timestamp TIMESTAMPTZ)
RETURNS void AS $$
DECLARE
  v_activity_date DATE;
  v_last_activity_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_weekdays_missed INTEGER;
BEGIN
  -- Convert to Israel timezone date
  v_activity_date := (p_activity_timestamp AT TIME ZONE 'Asia/Jerusalem')::DATE;

  -- Only process weekdays (Mon-Fri)
  IF NOT is_weekday_israel(p_activity_timestamp) THEN
    RETURN;
  END IF;

  -- Get or create streak record with row lock to prevent race conditions
  INSERT INTO user_streaks (user_id, last_activity_date, current_streak, longest_streak)
  VALUES (p_user_id, NULL, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fetch current values with row-level lock
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_activity_date, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Skip if same day activity (don't double count)
  IF v_last_activity_date = v_activity_date THEN
    RETURN;
  END IF;

  -- Calculate weekdays missed between last activity and current activity
  IF v_last_activity_date IS NULL THEN
    -- First activity ever, start streak
    v_current_streak := 1;
  ELSE
    v_weekdays_missed := count_weekdays_missed(v_last_activity_date, v_activity_date);

    IF v_weekdays_missed = 0 THEN
      -- No weekdays missed (consecutive weekday or weekend gap only)
      v_current_streak := v_current_streak + 1;
    ELSE
      -- Missed at least one weekday, reset streak
      v_current_streak := 1;
    END IF;
  END IF;

  -- Update longest streak if beaten
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Save updates
  UPDATE user_streaks
  SET
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_activity_date = v_activity_date,
    updated_at = NOW()
  WHERE user_id = p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Streak update failed for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. TRIGGER FUNCTIONS
-- =====================================================

-- Pre-workout forms
CREATE OR REPLACE FUNCTION trigger_streak_pre_workout()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.user_id, NEW.submitted_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Post-workout forms
CREATE OR REPLACE FUNCTION trigger_streak_post_workout()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.user_id, NEW.submitted_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nutrition forms
CREATE OR REPLACE FUNCTION trigger_streak_nutrition()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.user_id, NEW.submitted_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Video progress (only when marked as watched)
CREATE OR REPLACE FUNCTION trigger_streak_video()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.watched = TRUE AND NEW.watched_at IS NOT NULL THEN
    PERFORM update_user_streak(NEW.user_id, NEW.watched_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGERS
-- =====================================================

CREATE TRIGGER streak_after_pre_workout_insert
  AFTER INSERT ON pre_workout_forms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_streak_pre_workout();

CREATE TRIGGER streak_after_post_workout_insert
  AFTER INSERT ON post_workout_forms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_streak_post_workout();

CREATE TRIGGER streak_after_nutrition_insert
  AFTER INSERT ON nutrition_forms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_streak_nutrition();

CREATE TRIGGER streak_after_video_insert
  AFTER INSERT ON video_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_streak_video();

CREATE TRIGGER streak_after_video_update
  AFTER UPDATE ON video_progress
  FOR EACH ROW
  WHEN (NEW.watched = TRUE AND (OLD.watched = FALSE OR OLD.watched IS NULL))
  EXECUTE FUNCTION trigger_streak_video();

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Users can view their own streak
CREATE POLICY "Users can view own streak" ON user_streaks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins and trainers can view all streaks
CREATE POLICY "Admins can view all streaks" ON user_streaks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- System can insert/update streaks (triggers run with privileges)
CREATE POLICY "System can insert streaks" ON user_streaks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update streaks" ON user_streaks
  FOR UPDATE
  USING (true);
