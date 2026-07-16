-- Morning shifts (08:00-11:00 Israel time).
--
-- Adds a shift_period discriminator so a trainer's day can hold one morning
-- and one regular shift. Every "same day" rule is scoped by it.
--
-- Why this matters: approve_shift_change_request previously counted ALL of a
-- trainer's shifts on the requested date and treated a count of 1 as
-- retro_merge, which OVERWRITES that row's start/end times. Once two shifts
-- per day are legal, an unscoped merge would silently destroy the day's
-- regular shift when a morning request was approved, and any day holding two
-- shifts would fail every later retro_add with MULTI_MATCH.

-- CREATE TYPE has no IF NOT EXISTS form; guard it so the migration stays
-- rerunnable like the ALTERs below.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_period') THEN
    CREATE TYPE shift_period AS ENUM ('morning', 'regular');
  END IF;
END
$$;

ALTER TABLE trainer_shifts
  ADD COLUMN IF NOT EXISTS shift_period shift_period NOT NULL DEFAULT 'regular';

ALTER TABLE shift_change_requests
  ADD COLUMN IF NOT EXISTS shift_period shift_period NOT NULL DEFAULT 'regular';

-- Existing rows all default to 'regular'. History is deliberately not
-- reclassified by time-of-day.

CREATE INDEX IF NOT EXISTS trainer_shifts_trainer_period_start_idx
  ON trainer_shifts(trainer_id, shift_period, start_time DESC);

-- Replaces the function created in 20260509201054_shift_change_requests.sql.
-- Changes from that version:
--   1. Morning-window re-check (BAD_MORNING_WINDOW), mirroring the TS validator.
--   2. Same-day count and merge lookup scoped by shift_period.
--   3. retro_insert persists shift_period.
--   4. edit / retro_merge apply the request's shift_period, so an approval can
--      also correct a mislabeled period.
--   5. Every RAISE is repaired — see below.
-- The overlap check is intentionally left period-agnostic: a morning
-- 08:00-11:00 and a regular 10:00-14:00 genuinely conflict.
--
-- RAISE bug fix: the previous version used
--     RAISE EXCEPTION 'TOO_LONG' USING MESSAGE = '...';
-- which is invalid PL/pgSQL — a quoted string after RAISE EXCEPTION is the
-- format string and already sets MESSAGE, so USING MESSAGE collides and
-- Postgres raises 'RAISE option already specified: MESSAGE' instead. Every
-- guard still blocked (it failed safe), but approveShiftChangeRequestAction
-- passes rpcError.message straight to the admin's toast, so the Hebrew text
-- never reached anyone. The tag now travels in DETAIL, where it stays
-- available for logs without clobbering MESSAGE.
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
  v_morning_start_hour CONSTANT INT := 8;
  v_morning_end_hour CONSTANT INT := 11;
  v_duration_hours NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_same_day_count INT;
  v_target_shift trainer_shifts%ROWTYPE;
  v_merge_target trainer_shifts%ROWTYPE;
  v_overlap_shift trainer_shifts%ROWTYPE;
  v_resolved_shift_id UUID;
  v_mode TEXT;
  v_request_date DATE;
  v_start_local TIMESTAMP;
  v_end_local TIMESTAMP;
BEGIN
  -- Lock the request row to prevent races with cancellation/double-approval
  SELECT * INTO v_request FROM shift_change_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'הבקשה לא נמצאה', DETAIL = 'NOT_FOUND';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION USING MESSAGE = 'הבקשה כבר טופלה', DETAIL = 'ALREADY_DECIDED';
  END IF;

  -- Defense in depth: re-validate times
  IF v_request.requested_end_time <= v_request.requested_start_time THEN
    RAISE EXCEPTION USING MESSAGE = 'שעת סיום חייבת להיות אחרי שעת התחלה', DETAIL = 'BAD_TIMES';
  END IF;

  v_duration_hours := EXTRACT(EPOCH FROM (v_request.requested_end_time - v_request.requested_start_time)) / 3600.0;
  IF v_duration_hours > v_max_hours THEN
    RAISE EXCEPTION USING
      MESSAGE = format('משמרת לא יכולה להיות ארוכה יותר מ-%s שעות', v_max_hours),
      DETAIL = 'TOO_LONG';
  END IF;

  IF v_request.requested_end_time > v_now THEN
    RAISE EXCEPTION USING MESSAGE = 'שעת סיום חייבת להיות בעבר', DETAIL = 'FUTURE_END';
  END IF;

  -- Morning shifts must sit entirely inside 08:00-11:00 on one Israel day.
  IF v_request.shift_period = 'morning' THEN
    v_start_local := v_request.requested_start_time AT TIME ZONE 'Asia/Jerusalem';
    v_end_local := v_request.requested_end_time AT TIME ZONE 'Asia/Jerusalem';

    IF v_start_local::DATE <> v_end_local::DATE
       OR v_start_local < date_trunc('day', v_start_local) + make_interval(hours => v_morning_start_hour)
       OR v_end_local > date_trunc('day', v_end_local) + make_interval(hours => v_morning_end_hour)
    THEN
      RAISE EXCEPTION USING
        MESSAGE = format(
          'משמרת בוקר חייבת להיות בין %s:00 ל-%s:00',
          lpad(v_morning_start_hour::TEXT, 2, '0'),
          lpad(v_morning_end_hour::TEXT, 2, '0')
        ),
        DETAIL = 'BAD_MORNING_WINDOW';
    END IF;
  END IF;

  -- Resolve mode
  IF v_request.request_type = 'edit' THEN
    SELECT * INTO v_target_shift FROM trainer_shifts
    WHERE id = v_request.target_shift_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        MESSAGE = 'המשמרת המקורית נמחקה — דחה את הבקשה',
        DETAIL = 'TARGET_DELETED';
    END IF;

    v_mode := 'edit';
    v_resolved_shift_id := v_target_shift.id;
  ELSE
    -- retro_add: count existing shifts of the SAME PERIOD on the same
    -- calendar date (Asia/Jerusalem). A morning request never merges into
    -- the day's regular shift, and vice versa.
    v_request_date := (v_request.requested_start_time AT TIME ZONE 'Asia/Jerusalem')::DATE;

    SELECT COUNT(*) INTO v_same_day_count
    FROM trainer_shifts
    WHERE trainer_id = v_request.trainer_id
      AND shift_period = v_request.shift_period
      AND (start_time AT TIME ZONE 'Asia/Jerusalem')::DATE = v_request_date;

    IF v_same_day_count = 0 THEN
      v_mode := 'retro_insert';
    ELSIF v_same_day_count = 1 THEN
      SELECT * INTO v_merge_target
      FROM trainer_shifts
      WHERE trainer_id = v_request.trainer_id
        AND shift_period = v_request.shift_period
        AND (start_time AT TIME ZONE 'Asia/Jerusalem')::DATE = v_request_date
      FOR UPDATE;

      v_mode := 'retro_merge';
      v_resolved_shift_id := v_merge_target.id;
    ELSE
      RAISE EXCEPTION USING
        MESSAGE = 'קיימות מספר משמרות באותו תאריך — פתור ידנית לפני אישור',
        DETAIL = 'MULTI_MATCH';
    END IF;
  END IF;

  -- Overlap check against this trainer's other shifts, regardless of period.
  -- Adjacent (end == start) is NOT an overlap, so a morning ending 11:00 and
  -- a regular starting 11:00 both stand.
  SELECT * INTO v_overlap_shift
  FROM trainer_shifts
  WHERE trainer_id = v_request.trainer_id
    AND end_time IS NOT NULL
    AND (v_resolved_shift_id IS NULL OR id <> v_resolved_shift_id)
    AND start_time < v_request.requested_end_time
    AND end_time > v_request.requested_start_time
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'חופף למשמרת קיימת בתאריך %s %s–%s',
        to_char((v_overlap_shift.start_time AT TIME ZONE 'Asia/Jerusalem')::DATE, 'DD/MM'),
        to_char(v_overlap_shift.start_time AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI'),
        to_char(v_overlap_shift.end_time AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
      ),
      DETAIL = 'OVERLAP';
  END IF;

  -- Apply the change
  IF v_mode = 'edit' OR v_mode = 'retro_merge' THEN
    UPDATE trainer_shifts
    SET start_time = v_request.requested_start_time,
        end_time = v_request.requested_end_time,
        shift_period = v_request.shift_period,
        flagged_for_review = false,
        updated_at = v_now
    WHERE id = v_resolved_shift_id;
  ELSE -- retro_insert
    INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time, shift_period)
    VALUES (
      v_request.trainer_id,
      v_request.trainer_name,
      v_request.requested_start_time,
      v_request.requested_end_time,
      v_request.shift_period
    )
    RETURNING id INTO v_resolved_shift_id;
  END IF;

  -- Mark request approved
  UPDATE shift_change_requests
  SET status = 'approved', decided_by = p_actor_id, decided_at = v_now,
      decision_note = p_note, applied_shift_id = v_resolved_shift_id, updated_at = v_now
  WHERE id = p_request_id;

  applied_shift_id := v_resolved_shift_id;
  mode := v_mode;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION approve_shift_change_request(UUID, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION approve_shift_change_request(UUID, UUID, TEXT) TO authenticated;
