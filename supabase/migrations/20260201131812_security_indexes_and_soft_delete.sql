-- Security Indexes and Soft Delete Migration
-- Phase 1: Security Fixes

-- ============================================
-- 1. SECURITY-CRITICAL INDEXES
-- ============================================

-- Index on activity_logs for fast user audit queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON activity_logs(user_id);

-- Index on activity_logs for time-based queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON activity_logs(user_id, created_at DESC);

-- ============================================
-- 2. SOFT DELETE COLUMNS
-- ============================================

-- Add deleted_at to profiles (users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at to player_assessments
ALTER TABLE player_assessments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial unique index for profiles - only active users must have unique phone
-- (Allows re-creation of soft-deleted accounts)
DROP INDEX IF EXISTS idx_profiles_phone_unique_active;
CREATE UNIQUE INDEX idx_profiles_phone_unique_active
  ON profiles(phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- Partial unique index for assessments - prevent duplicate assessments on same date for active records
DROP INDEX IF EXISTS idx_assessments_user_date_active;
CREATE UNIQUE INDEX idx_assessments_user_date_active
  ON player_assessments(user_id, assessment_date)
  WHERE deleted_at IS NULL;

-- ============================================
-- 3. RLS POLICIES - SELECT (with soft delete)
-- ============================================

-- Drop existing SELECT policies to replace with soft-delete aware versions
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own assessments" ON player_assessments;
DROP POLICY IF EXISTS "Admins can view all assessments" ON player_assessments;

-- Profiles: Users see own (not deleted), Admins see all
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Assessments: Users see own (not deleted), Admins see all
CREATE POLICY "Users can view own assessments" ON player_assessments
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Admins can view all assessments" ON player_assessments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ============================================
-- 4. RLS POLICIES - UPDATE
-- ============================================

-- Profiles: Users can update own profile (not deleted)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (id = (SELECT auth.uid()) AND deleted_at IS NULL);

-- Profiles: Admins can update any profile
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Assessments: Only admins/trainers can update
DROP POLICY IF EXISTS "Trainers can update assessments" ON player_assessments;
CREATE POLICY "Trainers can update assessments" ON player_assessments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- ============================================
-- 5. RLS POLICIES - DELETE (block hard deletes)
-- ============================================

-- Profiles: Nobody can hard delete (use soft delete via UPDATE)
DROP POLICY IF EXISTS "No hard delete profiles" ON profiles;
CREATE POLICY "No hard delete profiles" ON profiles
  FOR DELETE
  TO authenticated
  USING (false);

-- Assessments: Nobody can hard delete (use soft delete via UPDATE)
DROP POLICY IF EXISTS "No hard delete assessments" ON player_assessments;
CREATE POLICY "No hard delete assessments" ON player_assessments
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- 6. CASCADE SOFT DELETE FUNCTION
-- ============================================

-- Function to soft delete user and all their data
CREATE OR REPLACE FUNCTION soft_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can soft delete users';
  END IF;

  -- Soft delete the user profile
  UPDATE profiles
  SET deleted_at = NOW()
  WHERE id = target_user_id;

  -- Soft delete all their assessments
  UPDATE player_assessments
  SET deleted_at = NOW()
  WHERE user_id = target_user_id;

  -- Note: Forms (pre_workout, post_workout, nutrition) are audit logs
  -- and should NOT be soft deleted - they're immutable records
END;
$$;

-- ============================================
-- 7. RLS POLICIES - FORM SUBMISSIONS (Immutable Audit Logs)
-- ============================================

-- Forms are immutable audit logs - INSERT only, no UPDATE/DELETE
-- Users can only insert their own forms, admins can view all

-- pre_workout_forms
DROP POLICY IF EXISTS "Users can insert own pre_workout_forms" ON pre_workout_forms;
CREATE POLICY "Users can insert own pre_workout_forms" ON pre_workout_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own pre_workout_forms" ON pre_workout_forms;
CREATE POLICY "Users can view own pre_workout_forms" ON pre_workout_forms
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all pre_workout_forms" ON pre_workout_forms;
CREATE POLICY "Admins can view all pre_workout_forms" ON pre_workout_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "No update pre_workout_forms" ON pre_workout_forms;
CREATE POLICY "No update pre_workout_forms" ON pre_workout_forms
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No delete pre_workout_forms" ON pre_workout_forms;
CREATE POLICY "No delete pre_workout_forms" ON pre_workout_forms
  FOR DELETE
  TO authenticated
  USING (false);

-- post_workout_forms (same pattern)
DROP POLICY IF EXISTS "Users can insert own post_workout_forms" ON post_workout_forms;
CREATE POLICY "Users can insert own post_workout_forms" ON post_workout_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own post_workout_forms" ON post_workout_forms;
CREATE POLICY "Users can view own post_workout_forms" ON post_workout_forms
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all post_workout_forms" ON post_workout_forms;
CREATE POLICY "Admins can view all post_workout_forms" ON post_workout_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "No update post_workout_forms" ON post_workout_forms;
CREATE POLICY "No update post_workout_forms" ON post_workout_forms
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No delete post_workout_forms" ON post_workout_forms;
CREATE POLICY "No delete post_workout_forms" ON post_workout_forms
  FOR DELETE
  TO authenticated
  USING (false);

-- nutrition_forms (same pattern)
DROP POLICY IF EXISTS "Users can insert own nutrition_forms" ON nutrition_forms;
CREATE POLICY "Users can insert own nutrition_forms" ON nutrition_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own nutrition_forms" ON nutrition_forms;
CREATE POLICY "Users can view own nutrition_forms" ON nutrition_forms
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all nutrition_forms" ON nutrition_forms;
CREATE POLICY "Admins can view all nutrition_forms" ON nutrition_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "No update nutrition_forms" ON nutrition_forms;
CREATE POLICY "No update nutrition_forms" ON nutrition_forms
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No delete nutrition_forms" ON nutrition_forms;
CREATE POLICY "No delete nutrition_forms" ON nutrition_forms
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- 8. RLS POLICIES - ACTIVITY LOGS (Append-Only Audit)
-- ============================================

-- activity_logs are append-only audit logs - INSERT only for system, SELECT for user/admin
DROP POLICY IF EXISTS "Users can view own activity_logs" ON activity_logs;
CREATE POLICY "Users can view own activity_logs" ON activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all activity_logs" ON activity_logs;
CREATE POLICY "Admins can view all activity_logs" ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "No update activity_logs" ON activity_logs;
CREATE POLICY "No update activity_logs" ON activity_logs
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No delete activity_logs" ON activity_logs;
CREATE POLICY "No delete activity_logs" ON activity_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- 9. RLS POLICIES - VIDEOS (Admin-Managed Content)
-- ============================================

-- videos are admin-managed, users can view
DROP POLICY IF EXISTS "Users can view videos" ON videos;
CREATE POLICY "Users can view videos" ON videos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage videos" ON videos;
CREATE POLICY "Admins can manage videos" ON videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- video_views - users can insert own views, admins can view all
DROP POLICY IF EXISTS "Users can insert own video_views" ON video_views;
CREATE POLICY "Users can insert own video_views" ON video_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all video_views" ON video_views;
CREATE POLICY "Admins can view all video_views" ON video_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "No update video_views" ON video_views;
CREATE POLICY "No update video_views" ON video_views
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No delete video_views" ON video_views;
CREATE POLICY "No delete video_views" ON video_views
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- 10. RLS POLICIES - STREAKS (Admin-Managed)
-- ============================================

DROP POLICY IF EXISTS "Users can view own streaks" ON streaks;
CREATE POLICY "Users can view own streaks" ON streaks
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all streaks" ON streaks;
CREATE POLICY "Admins can manage all streaks" ON streaks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ============================================
-- 11. RLS POLICIES - USER ACHIEVEMENTS (Read-Only for Users)
-- ============================================

DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage achievements" ON user_achievements;
CREATE POLICY "Admins can manage achievements" ON user_achievements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ============================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN profiles.deleted_at IS 'Soft delete timestamp. NULL = active, non-NULL = deleted';
COMMENT ON COLUMN player_assessments.deleted_at IS 'Soft delete timestamp. NULL = active, non-NULL = deleted';
COMMENT ON FUNCTION soft_delete_user IS 'Admin-only function to soft delete a user and cascade to their assessments';
