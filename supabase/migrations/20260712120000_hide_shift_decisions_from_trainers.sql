-- =====================================================
-- Hide admin approve/reject decisions from trainers
--
-- A trainer must not learn whether their shift change request was approved
-- or rejected, nor read the admin's decision note. Enforced at the data
-- layer (RLS), not only in the UI.
-- =====================================================

-- =====================================================
-- 1. shift_change_requests: trainers see only pending + cancelled
--
-- 'cancelled' must stay readable: cancelShiftChangeRequestAction issues
-- UPDATE ... RETURNING id, and PostgREST applies the SELECT policy to the
-- returned row. Blocking 'cancelled' would make a successful cancel report
-- "already handled or missing".
-- =====================================================
DROP POLICY IF EXISTS "Trainers can view own requests" ON shift_change_requests;
CREATE POLICY "Trainers can view own requests"
  ON shift_change_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = trainer_id
    AND status IN ('pending', 'cancelled')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('trainer', 'admin')
    )
  );

-- =====================================================
-- 2. activity_logs: close the decision-leak path
--
-- Migration 005 created "Admins can view all activity logs" (with a SPACE)
-- allowing role IN ('admin','trainer') to read EVERY activity log row.
-- Migration 20260201131812 tightened this to role = 'admin' but created the
-- policy under a new name ("activity_logs", with an UNDERSCORE) and only
-- dropped that new name, so the 005 policy survived. RLS policies OR
-- together, so trainers can currently read all logs — including the
-- shift_change_request_approved / _rejected rows that carry the decision
-- note in metadata.
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can view own activity logs" ON activity_logs;

-- A user reads their own log, except admin decisions on their shift requests.
DROP POLICY IF EXISTS "Users can view own activity_logs" ON activity_logs;
CREATE POLICY "Users can view own activity_logs" ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND action NOT IN (
      'shift_change_request_approved',
      'shift_change_request_rejected'
    )
  );

-- Trainers read trainee logs only — this is what ActivityLogTable needs on
-- /admin/users/[userId], which trainers may open for trainees.
DROP POLICY IF EXISTS "Trainers can view trainee activity_logs" ON activity_logs;
CREATE POLICY "Trainers can view trainee activity_logs" ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'trainer'
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = activity_logs.user_id AND role = 'trainee'
    )
  );
