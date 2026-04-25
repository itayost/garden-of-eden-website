-- supabase/migrations/20260425120100_recreate_user_achievements.sql
-- Re-applies the user_achievements table from migration 008 (which was
-- rolled back from production at some point). The accompanying SQL trigger
-- functions from 008 are NOT recreated here — TS owns badge granting.
--
-- Idempotent: safe to apply on environments where 008 already ran the type
-- and table (CASCADE drops dependent objects from the prior definition).

DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TYPE IF EXISTS achievement_badge_type CASCADE;

CREATE TYPE achievement_badge_type AS ENUM (
  'nutrition_form_completed',
  'profile_completed',
  'first_pre_workout',
  'first_post_workout',
  'first_video_watched',
  'videos_day_complete',
  'all_videos_watched',
  'first_assessment',
  'five_assessments',
  'ten_assessments',
  'sprint_improved',
  'jump_improved',
  'overall_improved_5pts',
  'overall_improved_10pts',
  'streak_7_days',
  'streak_30_days',
  'streak_100_days',
  'first_goal_achieved',
  'five_goals_achieved'
);

CREATE TABLE user_achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type   achievement_badge_type NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB,
  celebrated   BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT user_achievements_user_badge_unique UNIQUE (user_id, badge_type)
);

-- (No standalone idx on user_id: the unique constraint
--  user_achievements_user_badge_unique (user_id, badge_type) already
--  provides a btree whose leftmost column is user_id.)
CREATE INDEX idx_user_achievements_user_uncelebrated
  ON user_achievements (user_id) WHERE celebrated = FALSE;

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all achievements" ON user_achievements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Users can earn own achievements" ON user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users update own achievement celebrated flag" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE user_achievements IS
  'Earned badges per user. Granted by TS server actions (not SQL triggers). Single source of truth for badge list is src/features/achievements/lib/config/badge-config.ts.';
