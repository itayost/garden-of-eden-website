-- Hardening after review: one projected slot per band and date, the plan
-- caps re-checked under a per-trainee lock inside book_slot, and staff
-- roster edits that keep late cancels (they cost a session).

CREATE UNIQUE INDEX IF NOT EXISTS daily_schedule_slots_band_date_key
  ON public.daily_schedule_slots (band_id, schedule_date) WHERE band_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.book_slot(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.book_slot(
  p_slot_id UUID,
  p_trainee_id UUID,
  p_trainee_name TEXT,
  p_plan_starts DATE,
  p_plan_ends DATE,
  p_sessions_total INTEGER,   -- NULL for time plans
  p_sessions_used INTEGER,    -- past rows, counted by the app
  p_weekly_cap INTEGER,       -- NULL when the plan has no weekly cap
  p_today DATE
)
RETURNS TABLE (roster_id UUID, seats_taken INTEGER, max_trainees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max INTEGER;
  v_taken INTEGER;
  v_id UUID;
  v_active BOOLEAN;
  v_next INTEGER;
  v_date DATE;
  v_branch UUID;
  v_reserved INTEGER;
  v_week INTEGER;
  v_week_start DATE;
BEGIN
  -- One booking at a time per trainee: the plan caps below are counted
  -- fresh under this lock, so N parallel requests cannot all pass.
  PERFORM pg_advisory_xact_lock(hashtext(p_trainee_id::text));

  SELECT s.max_trainees, s.schedule_date, s.branch_id INTO v_max, v_date, v_branch
    FROM daily_schedule_slots s WHERE s.id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_not_found'; END IF;
  IF v_max IS NULL THEN RAISE EXCEPTION 'slot_not_bookable'; END IF;

  SELECT t.id, (t.cancelled_at IS NULL) INTO v_id, v_active
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.trainee_id = p_trainee_id;
  IF v_id IS NOT NULL AND v_active THEN RAISE EXCEPTION 'already_booked'; END IF;

  IF p_sessions_total IS NOT NULL THEN
    SELECT count(*)::int INTO v_reserved
      FROM daily_schedule_slot_trainees t
      JOIN daily_schedule_slots s ON s.id = t.slot_id
      WHERE t.trainee_id = p_trainee_id AND t.cancelled_at IS NULL
        AND s.branch_id = v_branch
        AND s.schedule_date > p_today
        AND s.schedule_date BETWEEN p_plan_starts AND p_plan_ends;
    IF p_sessions_total - p_sessions_used - v_reserved < 1 THEN RAISE EXCEPTION 'no_sessions_left'; END IF;
  END IF;

  IF p_weekly_cap IS NOT NULL THEN
    v_week_start := v_date - EXTRACT(DOW FROM v_date)::int;
    SELECT count(*)::int INTO v_week
      FROM daily_schedule_slot_trainees t
      JOIN daily_schedule_slots s ON s.id = t.slot_id
      WHERE t.trainee_id = p_trainee_id
        AND (t.cancelled_at IS NULL OR t.late_cancel)
        AND s.branch_id = v_branch
        AND s.schedule_date BETWEEN v_week_start AND v_week_start + 6;
    IF v_week >= p_weekly_cap THEN RAISE EXCEPTION 'weekly_cap'; END IF;
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

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $$;
REVOKE ALL ON FUNCTION public.book_slot(UUID, UUID, TEXT, DATE, DATE, INTEGER, INTEGER, INTEGER, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(UUID, UUID, TEXT, DATE, DATE, INTEGER, INTEGER, INTEGER, DATE)
  TO service_role;

-- Staff edits keep cancelled rows: a late cancel is a used session and an
-- audit line, and the dialog never lists cancelled rows to begin with.
CREATE OR REPLACE FUNCTION public.replace_slot_roster(p_slot_id UUID, p_trainees JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id
      AND (t.trainee_id IS NULL
           OR (t.cancelled_at IS NULL
               AND t.trainee_id NOT IN (
                 SELECT NULLIF(elem->>'trainee_id', '')::uuid FROM jsonb_array_elements(p_trainees) AS elem
                 WHERE NULLIF(elem->>'trainee_id', '') IS NOT NULL)));

  UPDATE daily_schedule_slot_trainees t
    SET trainee_name = elem->>'trainee_name',
        order_index = (elem->>'order_index')::int,
        cancelled_at = NULL,
        late_cancel = false
    FROM jsonb_array_elements(p_trainees) AS elem
    WHERE t.slot_id = p_slot_id
      AND t.trainee_id = NULLIF(elem->>'trainee_id', '')::uuid;

  INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index)
  SELECT p_slot_id,
         NULLIF(elem->>'trainee_id', '')::uuid,
         elem->>'trainee_name',
         (elem->>'order_index')::int
  FROM jsonb_array_elements(p_trainees) AS elem
  WHERE NULLIF(elem->>'trainee_id', '') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM daily_schedule_slot_trainees t
       WHERE t.slot_id = p_slot_id AND t.trainee_id = NULLIF(elem->>'trainee_id', '')::uuid);
END;
$$ LANGUAGE plpgsql SET search_path = public;
