-- A Booking or an Adjustment judged on a stale picture is refused (review of #97).
--
-- book_slot_checked compared only the trainee's counted roster rows, so a
-- Booking whose verdict was made before an Adjustment (or a Void) landed still
-- took the seat. The new 5-argument book_slot_checked also compares the
-- trainee's Plan stamps (trainee_plans.updated_at, kept by a trigger).
-- adjust_plan_sessions and adjust_plan_end_date now take the roster rows the
-- action counted and refuse if a Booking landed in between, so the shrink rule
-- never runs on a roster that misses one.
--
-- Expand only. The 4-argument book_slot_checked stays: the code running today
-- calls it. Drop it once the deploy that calls the 5-argument one is live.
-- The adjust functions are replaced outright; no deployed code calls them yet.

-- The trainee's roster rows that use a session, in id order: the set every
-- guard compares. rowCounts() in booking-rules.ts is the app's copy.
CREATE OR REPLACE FUNCTION public.counted_roster_row_ids(p_trainee_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(t.id ORDER BY t.id), '{}')
    FROM daily_schedule_slot_trainees t
    JOIN daily_schedule_slots s ON s.id = t.slot_id
    WHERE t.trainee_id = p_trainee_id
      AND (t.cancelled_at IS NULL OR t.late_cancel)
      -- A Called off Slot uses nobody's session.
      AND s.called_off_at IS NULL;
$function$;

-- The trainee's Plan stamps, sorted: any sale, undo act or Adjustment changes them.
CREATE OR REPLACE FUNCTION public.plan_stamps(p_trainee_id uuid)
RETURNS timestamptz[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(p.updated_at ORDER BY p.updated_at), '{}')
    FROM trainee_plans p
    WHERE p.profile_id = p_trainee_id;
$function$;

REVOKE ALL ON FUNCTION public.counted_roster_row_ids(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.counted_roster_row_ids(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.plan_stamps(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_stamps(uuid) TO service_role;

-- book_slot_checked, now also refusing when the trainee's Plans changed since
-- the verdict was made.
CREATE OR REPLACE FUNCTION public.book_slot_checked(
  p_slot_id uuid,
  p_trainee_id uuid,
  p_trainee_name text,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS TABLE(roster_id uuid, seats_taken integer, max_trainees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max INTEGER;
  v_taken INTEGER;
  v_id UUID;
  v_active BOOLEAN;
  v_next INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_trainee_id::text));

  SELECT s.max_trainees INTO v_max
    FROM daily_schedule_slots s WHERE s.id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_not_found'; END IF;
  IF v_max IS NULL THEN RAISE EXCEPTION 'slot_not_bookable'; END IF;

  SELECT t.id, (t.cancelled_at IS NULL) INTO v_id, v_active
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.trainee_id = p_trainee_id;
  IF v_id IS NOT NULL AND v_active THEN RAISE EXCEPTION 'already_booked'; END IF;

  IF counted_roster_row_ids(p_trainee_id) IS DISTINCT FROM
     (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(COALESCE(p_counted_row_ids, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'roster_changed';
  END IF;
  IF plan_stamps(p_trainee_id) IS DISTINCT FROM
     (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(COALESCE(p_plan_stamps, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'plans_changed';
  END IF;

  SELECT count(*)::int INTO v_taken
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.cancelled_at IS NULL;
  IF v_taken >= v_max THEN RAISE EXCEPTION 'capacity_full'; END IF;

  IF v_id IS NOT NULL THEN
    UPDATE daily_schedule_slot_trainees
      SET cancelled_at = NULL, late_cancel = false, booked_at = now(), source = 'self', reminded_at = NULL
      WHERE id = v_id;
  ELSE
    SELECT COALESCE(max(t.order_index), -1) + 1 INTO v_next
      FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id;
    INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source, booked_at)
      VALUES (p_slot_id, p_trainee_id, p_trainee_name, v_next, 'self', now())
      RETURNING id INTO v_id;
  END IF;

  -- A trainee who books after the group workout was written still gets it,
  -- in this transaction. No-ops when the slot has no group workout.
  PERFORM apply_slot_workout_to_trainee(p_slot_id, p_trainee_id);

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $function$;

REVOKE ALL ON FUNCTION public.book_slot_checked(uuid, uuid, text, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot_checked(uuid, uuid, text, uuid[], timestamptz[]) TO service_role;

-- The adjust functions, now refusing when a Booking landed after the action
-- read the roster.
DROP FUNCTION IF EXISTS public.adjust_plan_sessions(uuid, integer, integer, integer, text, uuid);
DROP FUNCTION IF EXISTS public.adjust_plan_end_date(uuid, date, integer, date, date, date, text, uuid);

CREATE FUNCTION public.adjust_plan_sessions(
  p_plan_id uuid,
  p_expected_total integer,
  p_new_total integer,
  p_used integer,
  p_counted_row_ids uuid[],
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_total integer;
  v_status text;
  v_ended_on date;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT sessions_total, status::text, ended_on INTO v_total, v_status, v_ended_on
    FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  -- A Void, Cancellation or Early end may have landed since the action read the Plan.
  IF v_status <> 'active' OR v_ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  IF v_total IS DISTINCT FROM p_expected_total THEN RAISE EXCEPTION 'balance_changed'; END IF;
  -- The used count and the shrink rule were worked out on these rows.
  IF counted_roster_row_ids(v_trainee) IS DISTINCT FROM
     (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(COALESCE(p_counted_row_ids, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'roster_changed';
  END IF;
  IF p_new_total IS NULL OR p_new_total < 1 THEN RAISE EXCEPTION 'invalid_total'; END IF;

  UPDATE trainee_plans
    SET sessions_total = p_new_total,
        reminded_last_session_at = CASE WHEN p_new_total > v_total THEN NULL ELSE reminded_last_session_at END,
        reminded_expired_at = CASE WHEN p_new_total > v_total THEN NULL ELSE reminded_expired_at END
    WHERE id = p_plan_id;

  INSERT INTO plan_adjustments (plan_id, kind, sessions_before, sessions_after, sessions_used, reason, created_by)
    VALUES (p_plan_id, 'sessions', v_total, p_new_total, p_used, p_reason, p_actor);
END $function$;

REVOKE ALL ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, integer, uuid[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, integer, uuid[], text, uuid) TO service_role;

-- p_duration_days and p_fixed_ends_on: exactly one is given, the other is NULL.
CREATE FUNCTION public.adjust_plan_end_date(
  p_plan_id uuid,
  p_expected_ends_on date,
  p_duration_days integer,
  p_fixed_ends_on date,
  p_ends_on date,
  p_ends_before date,
  p_counted_row_ids uuid[],
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_status text;
  v_ended_on date;
  v_ends_on date;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT status::text, ended_on, ends_on INTO v_status, v_ended_on, v_ends_on
    FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  IF v_status <> 'active' OR v_ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  IF v_ends_on IS DISTINCT FROM p_expected_ends_on THEN RAISE EXCEPTION 'plan_changed'; END IF;
  IF counted_roster_row_ids(v_trainee) IS DISTINCT FROM
     (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(COALESCE(p_counted_row_ids, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'roster_changed';
  END IF;
  IF (p_duration_days IS NULL) = (p_fixed_ends_on IS NULL) THEN RAISE EXCEPTION 'invalid_terms'; END IF;

  UPDATE trainee_plans
    SET duration_days = COALESCE(p_duration_days, duration_days),
        fixed_ends_on = COALESCE(p_fixed_ends_on, fixed_ends_on),
        not_before = COALESCE(not_before, starts_on),
        ends_on = p_ends_on,
        reminded_3_days_at = NULL,
        reminded_last_session_at = NULL,
        reminded_expired_at = NULL
    WHERE id = p_plan_id;

  INSERT INTO plan_adjustments (plan_id, kind, ends_before, ends_after, reason, created_by)
    VALUES (p_plan_id, 'end_date', p_ends_before, p_ends_on, p_reason, p_actor);
END $function$;

REVOKE ALL ON FUNCTION public.adjust_plan_end_date(uuid, date, integer, date, date, date, uuid[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_end_date(uuid, date, integer, date, date, date, uuid[], text, uuid) TO service_role;
