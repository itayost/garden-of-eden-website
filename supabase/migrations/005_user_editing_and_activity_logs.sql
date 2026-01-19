-- =====================================================
-- Migration 005: User Editing & Activity Logs
-- Adds is_active flag for soft delete
-- Creates activity_logs table for audit trail
-- =====================================================

-- =====================================================
-- 1. ADD is_active TO PROFILES TABLE
-- =====================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Mark existing users as active
UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;

-- Index for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_active
  ON profiles(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 2. CREATE ACTIVITY LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Subject of the activity (the user being acted upon)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Action type (enum-like string)
  action TEXT NOT NULL CHECK (action IN (
    'user_created',
    'user_updated',
    'user_activated',
    'user_deactivated',
    'role_changed',
    'profile_updated',
    'stats_created',
    'stats_updated',
    'assessment_created',
    'assessment_updated'
  )),

  -- Actor (who performed the action)
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,

  -- Change tracking (JSONB for flexibility)
  metadata JSONB,
  changes JSONB, -- Array of {field, old_value, new_value}

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 3. INDEXES FOR ACTIVITY LOGS
-- =====================================================
-- Query logs by user
CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);

-- Query logs by actor
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON activity_logs(actor_id, created_at DESC);

-- Query logs by action type
CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON activity_logs(action, created_at DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs" ON activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins and trainers can view all activity logs
CREATE POLICY "Admins can view all activity logs" ON activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Authenticated users can insert activity logs
CREATE POLICY "Authenticated users can insert activity logs" ON activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 5. UPDATE RLS POLICIES FOR PROFILES (Admin Update)
-- =====================================================
-- Allow admins to update any user profile
-- But prevent admins from changing their own role or is_active status
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Allow all updates for other users
    id != auth.uid()
    OR
    -- For self-updates, only allow if role and is_active remain unchanged
    (
      id = auth.uid()
      AND role = (SELECT role FROM profiles WHERE id = auth.uid())
      AND is_active = (SELECT is_active FROM profiles WHERE id = auth.uid())
    )
  );
