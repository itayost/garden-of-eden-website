-- A Booking or an Adjustment judged on a stale picture is refused (review of #97).
--
-- book_slot_checked compared only the trainee's counted roster rows, so a
-- Booking whose verdict was made before an Adjustment (or a Void) landed still
-- took the seat. One guard, assert_trainee_unchanged, now compares both the
-- counted roster rows and the Plan stamps (trainee_plans.updated_at, kept by a
-- trigger) the caller read, under the per-trainee lock. The new 5-argument
-- book_slot_checked and both adjust functions call it, so the used count and
-- the shrink rule never run on a roster or a queue that changed underneath.
-- The app still compares what the dialog showed with its own fresh read.
--
-- Expand only. The 4-argument book_slot_checked stays: the code running today
-- calls it. Drop it once the deploy that calls the 5-argument one is live.
-- The adjust functions are replaced outright; no deployed code calls them yet.

-- Raises roster_changed or plans_changed unless the trainee's counted roster
-- rows and Plan stamps are the ones the caller read. Call it holding the
-- per-trainee lock. The roster rule is rowCounts() in booking-rules.ts.
CREATE OR REPLACE FUNCTION public.assert_trainee_unchanged(
  p_trainee_id uuid,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT COALESCE(array_agg(t.id ORDER BY t.id), '{}')
        FROM daily_schedule_slot_trainees t
        JOIN daily_schedule_slots s ON s.id = t.slot_id
        WHERE t.trainee_id = p_trainee_id
          AND (t.cancelled_at IS NULL OR t.late_cancel)
          -- A Called off Slot uses nobody's session.
          AND s.called_off_at IS NULL)
     IS DISTINCT FROM
     (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(COALESCE(p_counted_row_ids, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'roster_changed';
  END IF;

  IF (SELECT COALESCE(array_agg(p.updated_at ORDER BY p.updated_at), '{}')
        FROM trainee_plans p WHERE p.profile_id = p_trainee_id)
     IS DISTINCT FROM
     (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(COALESCE(p_plan_stamps, '{}')) AS x)
  THEN
    RAISE EXCEPTION 'plans_changed';
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.assert_trainee_unchanged(uuid, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_trainee_unchanged(uuid, uuid[], timestamptz[]) TO service_role;

-- book_slot_checked, now refusing when the trainee's roster or Plans changed
-- since the verdict was made. A full slot is refused before the guard reads.
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

  SELECT count(*)::int INTO v_taken
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.cancelled_at IS NULL;
  IF v_taken >= v_max THEN RAISE EXCEPTION 'capacity_full'; END IF;

  -- The verdict holds only for the rows and Plans it was made on.
  PERFORM assert_trainee_unchanged(p_trainee_id, p_counted_row_ids, p_plan_stamps);

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

-- Takes the per-trainee lock and the Plan row, refuses a Plan no longer live,
-- then the guard. Both adjust functions open with it.
CREATE OR REPLACE FUNCTION public.lock_live_plan(
  p_plan_id uuid,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS trainee_plans
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_plan trainee_plans;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT * INTO v_plan FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  -- A Void, Cancellation or Early end may have landed since the action read the Plan.
  IF v_plan.status::text <> 'active' OR v_plan.ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  PERFORM assert_trainee_unchanged(v_trainee, p_counted_row_ids, p_plan_stamps);
  RETURN v_plan;
END $function$;

REVOKE ALL ON FUNCTION public.lock_live_plan(uuid, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_live_plan(uuid, uuid[], timestamptz[]) TO service_role;

-- The adjust functions take the roster rows and Plan stamps the action read
-- in place of an expected total or end: the stamps catch any change to them.
DROP FUNCTION IF EXISTS public.adjust_plan_sessions(uuid, integer, integer, integer, text, uuid);
DROP FUNCTION IF EXISTS public.adjust_plan_end_date(uuid, date, integer, date, date, date, text, uuid);

CREATE FUNCTION public.adjust_plan_sessions(
  p_plan_id uuid,
  p_new_total integer,
  p_used integer,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[],
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan trainee_plans;
BEGIN
  v_plan := lock_live_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
  IF p_new_total IS NULL OR p_new_total < 1 THEN RAISE EXCEPTION 'invalid_total'; END IF;

  -- The reminder stamps start over only when the Card gains sessions.
  UPDATE trainee_plans
    SET sessions_total = p_new_total,
        reminded_last_session_at = CASE WHEN p_new_total > v_plan.sessions_total THEN NULL ELSE reminded_last_session_at END,
        reminded_expired_at = CASE WHEN p_new_total > v_plan.sessions_total THEN NULL ELSE reminded_expired_at END
    WHERE id = p_plan_id;

  INSERT INTO plan_adjustments (plan_id, kind, sessions_before, sessions_after, sessions_used, reason, created_by)
    VALUES (p_plan_id, 'sessions', v_plan.sessions_total, p_new_total, p_used, p_reason, p_actor);
END $function$;

REVOKE ALL ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, uuid[], timestamptz[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, uuid[], timestamptz[], text, uuid) TO service_role;

-- p_duration_days and p_fixed_ends_on: exactly one is given, the other is NULL.
CREATE FUNCTION public.adjust_plan_end_date(
  p_plan_id uuid,
  p_duration_days integer,
  p_fixed_ends_on date,
  p_ends_on date,
  p_ends_before date,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[],
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM lock_live_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
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

REVOKE ALL ON FUNCTION public.adjust_plan_end_date(uuid, integer, date, date, date, uuid[], timestamptz[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_end_date(uuid, integer, date, date, date, uuid[], timestamptz[], text, uuid) TO service_role;
