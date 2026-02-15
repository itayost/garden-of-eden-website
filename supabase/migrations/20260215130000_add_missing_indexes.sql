-- Performance indexes for frequently queried columns
-- Form tables: queried by user_id on every dashboard load + admin submissions
CREATE INDEX IF NOT EXISTS idx_pre_workout_forms_user_id ON pre_workout_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_post_workout_forms_user_id ON post_workout_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_forms_user_id ON nutrition_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_user_id ON video_progress(user_id);

-- Achievements: queried per user on dashboard
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- Shift reports: queried by trainer on admin pages
CREATE INDEX IF NOT EXISTS idx_trainer_shift_reports_trainer_id ON trainer_shift_reports(trainer_id);

-- Profiles role: frequently filtered in rankings, admin, and calculateUserRatings
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Submission ordering: admin submissions page orders by submitted_at
CREATE INDEX IF NOT EXISTS idx_pre_workout_forms_submitted_at ON pre_workout_forms(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_workout_forms_submitted_at ON post_workout_forms(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_forms_submitted_at ON nutrition_forms(submitted_at DESC);
