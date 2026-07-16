-- Morning shifts do not exist on Friday.
--
-- Friday runs a single ~09:00-15:00 shift with no morning/regular split, ended
-- by the existing 15:00 auto-clockout. 20260716120000 classified any 08:00-11:00
-- clock-in as 'morning' on every day, which on Friday would mislabel a full work
-- day (43 historical Friday shifts start between 08:00 and 10:59 and run past
-- 11:00, e.g. 10:00-16:00) and let the 11:00 morning sweep force-end it hours
-- early.
--
-- The 09:00-15:00 Friday span is deliberately NOT enforced as a window: real
-- data has 39 Friday shifts ending after 15:00 and 24 starting at/after 15:00,
-- so hard bounds would reject an established pattern. The 15:00 force-end
-- remains the only Friday rule.
--
-- This replaces approve_shift_change_request from 20260716120000, adding only
-- the MORNING_ON_FRIDAY guard. Everything else is carried over verbatim.

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
  v_friday CONSTANT INT := 5;
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

  IF v_request.shift_period = 'morning' THEN
    v_start_local := v_request.requested_start_time AT TIME ZONE 'Asia/Jerusalem';
    v_end_local := v_request.requested_end_time AT TIME ZONE 'Asia/Jerusalem';

    -- No morning shift on Friday: the day is one ~09:00-15:00 block.
    IF EXTRACT(DOW FROM v_start_local) = v_friday THEN
      RAISE EXCEPTION USING
        MESSAGE = 'אין משמרת בוקר בימי שישי',
        DETAIL = 'MORNING_ON_FRIDAY';
    END IF;

    -- Morning shifts must sit entirely inside 08:00-11:00 on one Israel day.
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
