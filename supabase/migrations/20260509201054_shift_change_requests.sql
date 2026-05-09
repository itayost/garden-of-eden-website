-- =====================================================
-- Migration: shift_change_requests
-- Purpose: Lets trainers submit retro_add and edit requests for their own shifts.
--          Admins approve/reject in /admin/shifts. Approval auto-applies the change
--          to trainer_shifts via the approve_shift_change_request RPC.
-- =====================================================

-- =====================================================
-- 1. ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE shift_change_request_type AS ENUM ('edit', 'retro_add');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_change_request_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2. TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_name TEXT NOT NULL,
  request_type shift_change_request_type NOT NULL,
  target_shift_id UUID REFERENCES trainer_shifts(id) ON DELETE SET NULL,
  original_start_time TIMESTAMPTZ,
  original_end_time TIMESTAMPTZ,
  requested_start_time TIMESTAMPTZ NOT NULL,
  requested_end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status shift_change_request_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  applied_shift_id UUID REFERENCES trainer_shifts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT edit_has_target CHECK (
    (request_type = 'edit' AND target_shift_id IS NOT NULL)
    OR (request_type = 'retro_add' AND target_shift_id IS NULL)
  ),
  CONSTRAINT decided_consistency CHECK (
    (status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    OR status IN ('pending', 'cancelled')
  ),
  CONSTRAINT requested_end_after_start CHECK (requested_end_time > requested_start_time)
);

-- =====================================================
-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS shift_change_requests_trainer_id_idx
  ON shift_change_requests(trainer_id);
CREATE INDEX IF NOT EXISTS shift_change_requests_status_idx
  ON shift_change_requests(status);
CREATE INDEX IF NOT EXISTS shift_change_requests_created_at_idx
  ON shift_change_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS shift_change_requests_target_shift_id_idx
  ON shift_change_requests(target_shift_id);

-- =====================================================
-- 4. updated_at TRIGGER (reuses existing update_updated_at_column())
-- =====================================================
DROP TRIGGER IF EXISTS shift_change_requests_updated_at ON shift_change_requests;
CREATE TRIGGER shift_change_requests_updated_at
  BEFORE UPDATE ON shift_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================
ALTER TABLE shift_change_requests ENABLE ROW LEVEL SECURITY;

-- Trainers can INSERT own pending requests
DROP POLICY IF EXISTS "Trainers can insert own requests" ON shift_change_requests;
CREATE POLICY "Trainers can insert own requests"
  ON shift_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = trainer_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('trainer', 'admin')
        AND deleted_at IS NULL
    )
  );

-- Trainers can SELECT own
DROP POLICY IF EXISTS "Trainers can view own requests" ON shift_change_requests;
CREATE POLICY "Trainers can view own requests"
  ON shift_change_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('trainer', 'admin')
    )
  );

-- Trainers can UPDATE own only to cancel a pending request
DROP POLICY IF EXISTS "Trainers can cancel own pending requests" ON shift_change_requests;
CREATE POLICY "Trainers can cancel own pending requests"
  ON shift_change_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = trainer_id AND status = 'pending')
  WITH CHECK (auth.uid() = trainer_id AND status = 'cancelled');

-- Admins can SELECT all
DROP POLICY IF EXISTS "Admins can view all requests" ON shift_change_requests;
CREATE POLICY "Admins can view all requests"
  ON shift_change_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Admins can UPDATE any (approve/reject)
DROP POLICY IF EXISTS "Admins can update all requests" ON shift_change_requests;
CREATE POLICY "Admins can update all requests"
  ON shift_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- =====================================================
-- 6. EXPAND activity_logs CHECK CONSTRAINT
-- =====================================================
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check CHECK (action IN (
  'user_created',
  'user_updated',
  'user_activated',
  'user_deactivated',
  'role_changed',
  'profile_updated',
  'stats_created',
  'stats_updated',
  'assessment_created',
  'assessment_updated',
  'shift_change_request_created',
  'shift_change_request_approved',
  'shift_change_request_rejected',
  'shift_change_request_cancelled'
));

-- =====================================================
-- 7. ATOMIC APPROVAL FUNCTION
-- Runs as SECURITY DEFINER so the function can mutate trainer_shifts
-- and shift_change_requests as a single transactional unit.
-- The caller (server action) is responsible for verifying admin role
-- BEFORE invoking this function.
-- =====================================================
CREATE OR REPLACE FUNCTION approve_shift_change_request(
  p_request_id UUID,
  p_actor_id UUID,
  p_note TEXT
)
RETURNS TABLE(applied_shift_id UUID, mode TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request shift_change_requests%ROWTYPE;
  v_max_hours CONSTANT INT := 12;
  v_duration_hours NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_same_day_count INT;
  v_target_shift trainer_shifts%ROWTYPE;
  v_merge_target trainer_shifts%ROWTYPE;
  v_overlap_shift trainer_shifts%ROWTYPE;
  v_resolved_shift_id UUID;
  v_mode TEXT;
  v_request_date DATE;
BEGIN
  -- Lock the request row to prevent races with cancellation/double-approval
  SELECT * INTO v_request
  FROM shift_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING MESSAGE = 'הבקשה לא נמצאה';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'ALREADY_DECIDED' USING MESSAGE = 'הבקשה כבר טופלה';
  END IF;

  -- Defense in depth: re-validate times
  IF v_request.requested_end_time <= v_request.requested_start_time THEN
    RAISE EXCEPTION 'BAD_TIMES' USING MESSAGE = 'שעת סיום חייבת להיות אחרי שעת התחלה';
  END IF;

  v_duration_hours := EXTRACT(EPOCH FROM (v_request.requested_end_time - v_request.requested_start_time)) / 3600.0;
  IF v_duration_hours > v_max_hours THEN
    RAISE EXCEPTION 'TOO_LONG' USING MESSAGE = format('משמרת לא יכולה להיות ארוכה יותר מ-%s שעות', v_max_hours);
  END IF;

  IF v_request.requested_end_time > v_now THEN
    RAISE EXCEPTION 'FUTURE_END' USING MESSAGE = 'שעת סיום חייבת להיות בעבר';
  END IF;

  -- Resolve mode
  IF v_request.request_type = 'edit' THEN
    SELECT * INTO v_target_shift
    FROM trainer_shifts
    WHERE id = v_request.target_shift_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TARGET_DELETED' USING MESSAGE = 'המשמרת המקורית נמחקה — דחה את הבקשה';
    END IF;

    v_mode := 'edit';
    v_resolved_shift_id := v_target_shift.id;
  ELSE
    -- retro_add: count existing shifts on the same calendar date (Asia/Jerusalem)
    v_request_date := (v_request.requested_start_time AT TIME ZONE 'Asia/Jerusalem')::DATE;

    SELECT COUNT(*) INTO v_same_day_count
    FROM trainer_shifts
    WHERE trainer_id = v_request.trainer_id
      AND (start_time AT TIME ZONE 'Asia/Jerusalem')::DATE = v_request_date;

    IF v_same_day_count = 0 THEN
      v_mode := 'retro_insert';
    ELSIF v_same_day_count = 1 THEN
      SELECT * INTO v_merge_target
      FROM trainer_shifts
      WHERE trainer_id = v_request.trainer_id
        AND (start_time AT TIME ZONE 'Asia/Jerusalem')::DATE = v_request_date
      FOR UPDATE;

      v_mode := 'retro_merge';
      v_resolved_shift_id := v_merge_target.id;
    ELSE
      RAISE EXCEPTION 'MULTI_MATCH' USING MESSAGE = 'קיימות מספר משמרות באותו תאריך — פתור ידנית לפני אישור';
    END IF;
  END IF;

  -- Overlap check against this trainer's other shifts.
  -- Adjacent (end == start) is NOT an overlap.
  SELECT * INTO v_overlap_shift
  FROM trainer_shifts
  WHERE trainer_id = v_request.trainer_id
    AND end_time IS NOT NULL
    AND (v_resolved_shift_id IS NULL OR id <> v_resolved_shift_id)
    AND start_time < v_request.requested_end_time
    AND end_time > v_request.requested_start_time
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'OVERLAP' USING MESSAGE = format(
      'חופף למשמרת קיימת בתאריך %s %s–%s',
      to_char((v_overlap_shift.start_time AT TIME ZONE 'Asia/Jerusalem')::DATE, 'DD/MM'),
      to_char(v_overlap_shift.start_time AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI'),
      to_char(v_overlap_shift.end_time AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
    );
  END IF;

  -- Apply the change
  IF v_mode = 'edit' OR v_mode = 'retro_merge' THEN
    UPDATE trainer_shifts
    SET start_time = v_request.requested_start_time,
        end_time = v_request.requested_end_time,
        flagged_for_review = false,
        updated_at = v_now
    WHERE id = v_resolved_shift_id;
  ELSE -- retro_insert
    INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time)
    VALUES (
      v_request.trainer_id,
      v_request.trainer_name,
      v_request.requested_start_time,
      v_request.requested_end_time
    )
    RETURNING id INTO v_resolved_shift_id;
  END IF;

  -- Mark request approved
  UPDATE shift_change_requests
  SET status = 'approved',
      decided_by = p_actor_id,
      decided_at = v_now,
      decision_note = p_note,
      applied_shift_id = v_resolved_shift_id,
      updated_at = v_now
  WHERE id = p_request_id;

  applied_shift_id := v_resolved_shift_id;
  mode := v_mode;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION approve_shift_change_request(UUID, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION approve_shift_change_request(UUID, UUID, TEXT) TO authenticated;
