-- =====================================================
-- Migration 008: Achievement Badges System
-- Gamification badges for player accomplishments
-- Automatic badge unlocking via triggers
-- =====================================================

-- =====================================================
-- 1. BADGE TYPES ENUM
-- =====================================================
CREATE TYPE achievement_badge_type AS ENUM (
  -- Onboarding badges
  'nutrition_form_completed',       -- Completed nutrition questionnaire
  'profile_completed',              -- Completed profile
  'first_pre_workout',             -- First pre-workout form
  'first_post_workout',            -- First post-workout form

  -- Video badges
  'first_video_watched',           -- Watched first video
  'videos_day_complete',           -- Completed all videos for a day
  'all_videos_watched',            -- Watched all videos

  -- Assessment badges
  'first_assessment',              -- Received first assessment
  'five_assessments',              -- 5 assessments completed
  'ten_assessments',               -- 10 assessments completed

  -- Improvement badges (unlocked by triggers on assessment improvements)
  'sprint_improved',               -- Improved any sprint time
  'jump_improved',                 -- Improved any jump metric
  'overall_improved_5pts',         -- Overall rating improved by 5+ points
  'overall_improved_10pts',        -- Overall rating improved by 10+ points

  -- Streak badges
  'streak_7_days',                 -- 7 day streak
  'streak_30_days',                -- 30 day streak
  'streak_100_days',               -- 100 day streak

  -- Goal badges
  'first_goal_achieved',           -- Achieved first goal
  'five_goals_achieved'            -- Achieved 5 goals
);

-- =====================================================
-- 2. CREATE user_achievements TABLE
-- =====================================================
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_type achievement_badge_type NOT NULL,

  -- When the badge was unlocked
  unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Optional metadata (e.g., which video day, which metric improved)
  metadata JSONB DEFAULT '{}',

  -- Has user seen the celebration for this badge?
  celebrated BOOLEAN DEFAULT FALSE,

  -- One badge of each type per user
  UNIQUE(user_id, badge_type)
);

-- Indexes for performance
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON user_achievements(badge_type);
CREATE INDEX idx_user_achievements_uncelebrated ON user_achievements(user_id) WHERE NOT celebrated;

-- =====================================================
-- 3. HELPER FUNCTION: Grant badge if not already earned
-- =====================================================
CREATE OR REPLACE FUNCTION grant_achievement_badge(
  p_user_id UUID,
  p_badge_type achievement_badge_type,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  badge_granted BOOLEAN := FALSE;
BEGIN
  -- Try to insert the badge (will fail silently if already exists due to unique constraint)
  INSERT INTO user_achievements (user_id, badge_type, metadata)
  VALUES (p_user_id, p_badge_type, p_metadata)
  ON CONFLICT (user_id, badge_type) DO NOTHING;

  -- Check if we actually inserted
  GET DIAGNOSTICS badge_granted = ROW_COUNT;

  RETURN badge_granted > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGER: Badge for nutrition form completion
-- =====================================================
CREATE OR REPLACE FUNCTION check_nutrition_form_badge()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM grant_achievement_badge(NEW.user_id, 'nutrition_form_completed');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Nutrition badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_nutrition_form
  AFTER INSERT ON nutrition_forms
  FOR EACH ROW
  EXECUTE FUNCTION check_nutrition_form_badge();

-- =====================================================
-- 5. TRIGGER: Badge for profile completion
-- =====================================================
CREATE OR REPLACE FUNCTION check_profile_completed_badge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant if profile_completed is being set to true
  IF NEW.profile_completed = TRUE AND (OLD.profile_completed IS NULL OR OLD.profile_completed = FALSE) THEN
    PERFORM grant_achievement_badge(NEW.id, 'profile_completed');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile badge check failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_profile_completed
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_completed_badge();

-- =====================================================
-- 6. TRIGGER: Badge for first pre/post workout forms
-- =====================================================
CREATE OR REPLACE FUNCTION check_pre_workout_badge()
RETURNS TRIGGER AS $$
DECLARE
  form_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO form_count FROM pre_workout_forms WHERE user_id = NEW.user_id;

  IF form_count = 1 THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'first_pre_workout');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Pre-workout badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_pre_workout_form
  AFTER INSERT ON pre_workout_forms
  FOR EACH ROW
  EXECUTE FUNCTION check_pre_workout_badge();

CREATE OR REPLACE FUNCTION check_post_workout_badge()
RETURNS TRIGGER AS $$
DECLARE
  form_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO form_count FROM post_workout_forms WHERE user_id = NEW.user_id;

  IF form_count = 1 THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'first_post_workout');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Post-workout badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_post_workout_form
  AFTER INSERT ON post_workout_forms
  FOR EACH ROW
  EXECUTE FUNCTION check_post_workout_badge();

-- =====================================================
-- 7. TRIGGER: Video watching badges
-- =====================================================
CREATE OR REPLACE FUNCTION check_video_watching_badges()
RETURNS TRIGGER AS $$
DECLARE
  total_videos INTEGER;
  watched_videos INTEGER;
  videos_per_day RECORD;
  day_videos INTEGER;
  day_watched INTEGER;
BEGIN
  -- Only process if setting watched to true
  IF NEW.watched = TRUE AND (OLD IS NULL OR OLD.watched = FALSE) THEN

    -- First video badge
    SELECT COUNT(*) INTO watched_videos
    FROM video_progress
    WHERE user_id = NEW.user_id AND watched = TRUE;

    IF watched_videos = 1 THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'first_video_watched');
    END IF;

    -- Check for all videos badge
    SELECT COUNT(*) INTO total_videos FROM workout_videos;

    IF watched_videos = total_videos THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'all_videos_watched');
    END IF;

    -- Check for day completion badge
    SELECT wv.day_number INTO videos_per_day
    FROM workout_videos wv
    WHERE wv.id = NEW.video_id;

    IF videos_per_day IS NOT NULL THEN
      SELECT COUNT(*) INTO day_videos
      FROM workout_videos
      WHERE day_number = videos_per_day.day_number;

      SELECT COUNT(*) INTO day_watched
      FROM video_progress vp
      JOIN workout_videos wv ON vp.video_id = wv.id
      WHERE vp.user_id = NEW.user_id
        AND vp.watched = TRUE
        AND wv.day_number = videos_per_day.day_number;

      IF day_videos = day_watched THEN
        PERFORM grant_achievement_badge(
          NEW.user_id,
          'videos_day_complete',
          jsonb_build_object('day_number', videos_per_day.day_number)
        );
      END IF;
    END IF;

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Video badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_video_progress
  AFTER INSERT OR UPDATE ON video_progress
  FOR EACH ROW
  EXECUTE FUNCTION check_video_watching_badges();

-- =====================================================
-- 8. TRIGGER: Assessment badges
-- =====================================================
CREATE OR REPLACE FUNCTION check_assessment_badges()
RETURNS TRIGGER AS $$
DECLARE
  assessment_count INTEGER;
  prev_assessment RECORD;
  improved_sprint BOOLEAN := FALSE;
  improved_jump BOOLEAN := FALSE;
  overall_improvement DECIMAL;
BEGIN
  -- Count assessments for this user
  SELECT COUNT(*) INTO assessment_count
  FROM player_assessments
  WHERE user_id = NEW.user_id;

  -- First assessment badge
  IF assessment_count = 1 THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'first_assessment');
  END IF;

  -- 5 assessments badge
  IF assessment_count = 5 THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'five_assessments');
  END IF;

  -- 10 assessments badge
  IF assessment_count = 10 THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'ten_assessments');
  END IF;

  -- Check for improvements (compare with previous assessment)
  IF assessment_count > 1 THEN
    SELECT * INTO prev_assessment
    FROM player_assessments
    WHERE user_id = NEW.user_id
      AND id != NEW.id
    ORDER BY assessment_date DESC
    LIMIT 1;

    IF prev_assessment IS NOT NULL THEN
      -- Sprint improvement (lower is better)
      IF (NEW.sprint_5m IS NOT NULL AND prev_assessment.sprint_5m IS NOT NULL AND NEW.sprint_5m < prev_assessment.sprint_5m)
         OR (NEW.sprint_10m IS NOT NULL AND prev_assessment.sprint_10m IS NOT NULL AND NEW.sprint_10m < prev_assessment.sprint_10m)
         OR (NEW.sprint_20m IS NOT NULL AND prev_assessment.sprint_20m IS NOT NULL AND NEW.sprint_20m < prev_assessment.sprint_20m) THEN
        improved_sprint := TRUE;
        PERFORM grant_achievement_badge(NEW.user_id, 'sprint_improved');
      END IF;

      -- Jump improvement (higher is better)
      IF (NEW.jump_2leg_distance IS NOT NULL AND prev_assessment.jump_2leg_distance IS NOT NULL AND NEW.jump_2leg_distance > prev_assessment.jump_2leg_distance)
         OR (NEW.jump_2leg_height IS NOT NULL AND prev_assessment.jump_2leg_height IS NOT NULL AND NEW.jump_2leg_height > prev_assessment.jump_2leg_height)
         OR (NEW.jump_right_leg IS NOT NULL AND prev_assessment.jump_right_leg IS NOT NULL AND NEW.jump_right_leg > prev_assessment.jump_right_leg)
         OR (NEW.jump_left_leg IS NOT NULL AND prev_assessment.jump_left_leg IS NOT NULL AND NEW.jump_left_leg > prev_assessment.jump_left_leg) THEN
        improved_jump := TRUE;
        PERFORM grant_achievement_badge(NEW.user_id, 'jump_improved');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Assessment badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_assessment
  AFTER INSERT ON player_assessments
  FOR EACH ROW
  EXECUTE FUNCTION check_assessment_badges();

-- =====================================================
-- 9. TRIGGER: Overall rating improvement badges
-- =====================================================
CREATE OR REPLACE FUNCTION check_overall_rating_badges()
RETURNS TRIGGER AS $$
DECLARE
  first_stats RECORD;
  improvement DECIMAL;
BEGIN
  -- Get the first stats record for this user (from history)
  SELECT * INTO first_stats
  FROM player_stats_history
  WHERE user_id = NEW.user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_stats IS NOT NULL THEN
    improvement := NEW.overall_rating - first_stats.overall_rating;

    IF improvement >= 10 THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'overall_improved_10pts');
    ELSIF improvement >= 5 THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'overall_improved_5pts');
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Overall rating badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_stats_update
  AFTER UPDATE ON player_stats
  FOR EACH ROW
  WHEN (NEW.overall_rating IS DISTINCT FROM OLD.overall_rating)
  EXECUTE FUNCTION check_overall_rating_badges();

-- =====================================================
-- 10. TRIGGER: Streak badges (extend existing streak logic)
-- =====================================================
CREATE OR REPLACE FUNCTION check_streak_badges()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if streak milestones are reached
  IF NEW.current_streak >= 7 AND (OLD.current_streak IS NULL OR OLD.current_streak < 7) THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'streak_7_days');
  END IF;

  IF NEW.current_streak >= 30 AND (OLD.current_streak IS NULL OR OLD.current_streak < 30) THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'streak_30_days');
  END IF;

  IF NEW.current_streak >= 100 AND (OLD.current_streak IS NULL OR OLD.current_streak < 100) THEN
    PERFORM grant_achievement_badge(NEW.user_id, 'streak_100_days');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Streak badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_streak_update
  AFTER UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION check_streak_badges();

-- =====================================================
-- 11. TRIGGER: Goal achievement badges
-- =====================================================
CREATE OR REPLACE FUNCTION check_goal_badges()
RETURNS TRIGGER AS $$
DECLARE
  achieved_count INTEGER;
BEGIN
  -- Only process if goal was just achieved
  IF NEW.achieved_at IS NOT NULL AND (OLD.achieved_at IS NULL) THEN

    SELECT COUNT(*) INTO achieved_count
    FROM player_goals
    WHERE user_id = NEW.user_id AND achieved_at IS NOT NULL;

    -- First goal badge
    IF achieved_count = 1 THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'first_goal_achieved');
    END IF;

    -- 5 goals badge
    IF achieved_count = 5 THEN
      PERFORM grant_achievement_badge(NEW.user_id, 'five_goals_achieved');
    END IF;

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Goal badge check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER badge_on_goal_achieved
  AFTER UPDATE ON player_goals
  FOR EACH ROW
  EXECUTE FUNCTION check_goal_badges();

-- =====================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can view their own achievements
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update celebrated status on their own achievements
CREATE POLICY "Users can update celebrated status" ON user_achievements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trainers and admins can view all achievements
CREATE POLICY "Trainers can view all achievements" ON user_achievements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- System can insert achievements (via triggers)
CREATE POLICY "System can insert achievements" ON user_achievements
  FOR INSERT
  WITH CHECK (TRUE);

-- =====================================================
-- 13. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE user_achievements IS 'Gamification badges earned by players';
COMMENT ON COLUMN user_achievements.badge_type IS 'Type of achievement badge';
COMMENT ON COLUMN user_achievements.metadata IS 'Additional context (e.g., which day completed for videos)';
COMMENT ON COLUMN user_achievements.celebrated IS 'Whether user has seen the celebration toast';
