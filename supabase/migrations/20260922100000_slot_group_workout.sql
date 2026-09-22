-- A group workout on a schedule slot (spec 2026-09-22).
--
-- Kiryat Ata is group training: everyone booked into a slot does the same
-- workout. The slot holds that list and is the source of truth, but a trainee
-- cannot see or log a workout that has no training_sessions row of their own
-- (exercise_logs.session_exercise_id and the trainee RLS policy both key off
-- training_session_exercises), so saving the slot's list also writes one
-- session per active roster member.
--
-- training_sessions.slot_workout_synced_at NOT NULL means "this session was
-- written by the group and nobody has touched it individually since". Saving
-- from the individual builder clears it, and that is the exception the client
-- asked for: a trainer's own edit survives every later group save.

CREATE TABLE IF NOT EXISTS public.slot_workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps_he TEXT,
  target_load_he TEXT,
  target_reps INTEGER,
  target_weight_kg NUMERIC(5,2),
  target_duration_seconds INTEGER,
  target_distance_m INTEGER,
  notes_he TEXT,
  -- Same bounds as training_session_exercises: a target that passes here and
  -- fails there would break the fan-out after the trainer already saved.
  CONSTRAINT slot_workout_exercises_targets_range CHECK (
    (target_reps IS NULL OR target_reps BETWEEN 1 AND 999)
    AND (target_weight_kg IS NULL OR target_weight_kg BETWEEN 0 AND 500)
    AND (target_duration_seconds IS NULL OR target_duration_seconds BETWEEN 1 AND 86400)
    AND (target_distance_m IS NULL OR target_distance_m BETWEEN 1 AND 100000)
  )
);

CREATE INDEX IF NOT EXISTS idx_slot_workout_exercises_slot
  ON public.slot_workout_exercises (slot_id, order_index);

ALTER TABLE public.slot_workout_exercises ENABLE ROW LEVEL SECURITY;

-- Staff only, and no trainee policy at all: a trainee reads the copy that was
-- written for them, never the slot's list.
DROP POLICY IF EXISTS "slot_workout_exercises_staff_all" ON public.slot_workout_exercises;
CREATE POLICY "slot_workout_exercises_staff_all" ON public.slot_workout_exercises
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'trainer')
      AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'trainer')
      AND p.deleted_at IS NULL));

-- workout_built_by is not bookkeeping. training_sessions.built_by is NOT NULL,
-- and a trainee booking themselves in brings no staff user with the request,
-- so a fanned-out session is credited to whoever wrote the group workout.
ALTER TABLE public.daily_schedule_slots
  ADD COLUMN IF NOT EXISTS workout_notes_he TEXT,
  ADD COLUMN IF NOT EXISTS workout_built_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS workout_built_by_name TEXT,
  ADD COLUMN IF NOT EXISTS workout_updated_at TIMESTAMPTZ;

ALTER TABLE public.daily_schedule_slots
  DROP CONSTRAINT IF EXISTS slot_workout_notes_length;
ALTER TABLE public.daily_schedule_slots
  ADD CONSTRAINT slot_workout_notes_length
  CHECK (char_length(workout_notes_he) <= 300);

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS slot_workout_synced_at TIMESTAMPTZ;

-- One roster member's copy. Returns the action it took, using the same five
-- names as planSlotWorkoutFanout() in src/lib/schedule/slot-workout-fanout.ts,
-- plus skip_no_workout for a slot that has no group workout to give.
CREATE OR REPLACE FUNCTION public.apply_slot_workout_to_trainee(
  p_slot_id UUID,
  p_trainee_id UUID
) RETURNS TEXT
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_date DATE;
  v_notes TEXT;
  v_by UUID;
  v_by_name TEXT;
  v_has_exercises BOOLEAN;
  v_session_id UUID;
  v_session_slot UUID;
  v_synced TIMESTAMPTZ;
  v_completed TIMESTAMPTZ;
BEGIN
  SELECT s.schedule_date, s.workout_notes_he, s.workout_built_by, s.workout_built_by_name
    INTO v_date, v_notes, v_by, v_by_name
    FROM daily_schedule_slots s WHERE s.id = p_slot_id;
  IF NOT FOUND THEN RETURN 'skip_no_workout'; END IF;

  SELECT EXISTS (SELECT 1 FROM slot_workout_exercises e WHERE e.slot_id = p_slot_id)
    INTO v_has_exercises;
  IF NOT v_has_exercises OR v_by IS NULL THEN RETURN 'skip_no_workout'; END IF;

  SELECT ts.id, ts.slot_id, ts.slot_workout_synced_at, ts.completed_at
    INTO v_session_id, v_session_slot, v_synced, v_completed
    FROM training_sessions ts
    WHERE ts.trainee_id = p_trainee_id AND ts.session_date = v_date;

  IF v_session_id IS NOT NULL THEN
    IF v_completed IS NOT NULL THEN RETURN 'skip_completed'; END IF;
    IF v_synced IS NULL THEN RETURN 'skip_custom'; END IF;
    IF v_session_slot IS DISTINCT FROM p_slot_id THEN RETURN 'skip_other_slot'; END IF;

    -- The credit stays with whoever wrote the group workout, not with whoever
    -- pressed save this time.
    UPDATE training_sessions
      SET notes_he = v_notes,
          built_by = v_by,
          built_by_name = v_by_name,
          slot_workout_synced_at = now()
      WHERE id = v_session_id;
  ELSE
    INSERT INTO training_sessions
      (trainee_id, session_date, slot_id, built_by, built_by_name, notes_he, slot_workout_synced_at)
      VALUES (p_trainee_id, v_date, p_slot_id, v_by, v_by_name, v_notes, now())
      RETURNING id INTO v_session_id;
  END IF;

  DELETE FROM training_session_exercises WHERE session_id = v_session_id;
  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he,
     notes_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT v_session_id, e.exercise_id, e.order_index, e.target_sets, e.target_reps_he,
         e.target_load_he, e.notes_he, e.target_reps, e.target_weight_kg,
         e.target_duration_seconds, e.target_distance_m
    FROM slot_workout_exercises e
    WHERE e.slot_id = p_slot_id
    ORDER BY e.order_index;

  -- v_synced is only set when the SELECT above found a row to refresh.
  RETURN CASE WHEN v_synced IS NULL THEN 'create' ELSE 'refresh' END;
END $$;

REVOKE ALL ON FUNCTION public.apply_slot_workout_to_trainee(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_slot_workout_to_trainee(UUID, UUID) TO authenticated, service_role;

-- The whole roster, as counts per action.
CREATE OR REPLACE FUNCTION public.apply_slot_workout(p_slot_id UUID)
RETURNS TABLE (action TEXT, trainee_count INTEGER)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT r.action, count(*)::int
    FROM (
      SELECT apply_slot_workout_to_trainee(p_slot_id, t.trainee_id) AS action
        FROM daily_schedule_slot_trainees t
        WHERE t.slot_id = p_slot_id
          AND t.trainee_id IS NOT NULL
          AND t.cancelled_at IS NULL
        ORDER BY t.order_index
    ) r
   GROUP BY r.action;
END $$;

REVOKE ALL ON FUNCTION public.apply_slot_workout(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_slot_workout(UUID) TO authenticated, service_role;

-- Saving the group workout is the fan-out. Separating them would allow a saved
-- workout that reached nobody, which is the whole failure this design avoids.
CREATE OR REPLACE FUNCTION public.save_slot_workout(
  p_slot_id UUID,
  p_notes TEXT,
  p_built_by UUID,
  p_built_by_name TEXT,
  p_exercises JSONB
) RETURNS TABLE (action TEXT, trainee_count INTEGER)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM slot_workout_exercises WHERE slot_id = p_slot_id;

  INSERT INTO slot_workout_exercises
    (slot_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he,
     target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT
    p_slot_id,
    (elem->>'exercise_id')::uuid,
    (elem->>'order_index')::int,
    NULLIF(elem->>'target_sets', '')::int,
    NULLIF(elem->>'target_reps_he', ''),
    NULLIF(elem->>'target_load_he', ''),
    NULLIF(elem->>'notes_he', ''),
    NULLIF(elem->>'target_reps', '')::int,
    NULLIF(elem->>'target_weight_kg', '')::numeric,
    NULLIF(elem->>'target_duration_seconds', '')::int,
    NULLIF(elem->>'target_distance_m', '')::int
  FROM jsonb_array_elements(p_exercises) AS elem;

  UPDATE daily_schedule_slots
    SET workout_notes_he = p_notes,
        workout_built_by = p_built_by,
        workout_built_by_name = p_built_by_name,
        workout_updated_at = now()
    WHERE id = p_slot_id;

  RETURN QUERY SELECT * FROM apply_slot_workout(p_slot_id);
END $$;

REVOKE ALL ON FUNCTION public.save_slot_workout(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_slot_workout(UUID, TEXT, UUID, TEXT, JSONB) TO authenticated, service_role;

-- Removing the group workout removes the copies it wrote, and only those:
-- never a session a trainer edited individually, never one already completed.
CREATE OR REPLACE FUNCTION public.clear_slot_workout(p_slot_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_removed INTEGER;
BEGIN
  DELETE FROM slot_workout_exercises WHERE slot_id = p_slot_id;

  UPDATE daily_schedule_slots
    SET workout_notes_he = NULL,
        workout_built_by = NULL,
        workout_built_by_name = NULL,
        workout_updated_at = NULL
    WHERE id = p_slot_id;

  WITH removed AS (
    DELETE FROM training_sessions ts
      WHERE ts.slot_id = p_slot_id
        AND ts.slot_workout_synced_at IS NOT NULL
        AND ts.completed_at IS NULL
      RETURNING 1
  )
  SELECT count(*)::int INTO v_removed FROM removed;

  RETURN v_removed;
END $$;

REVOKE ALL ON FUNCTION public.clear_slot_workout(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_slot_workout(UUID) TO authenticated, service_role;

-- One trainee leaves the slot, by their own cancellation or by staff removing
-- them, so the workout leaves their app. Same two exemptions as above.
CREATE OR REPLACE FUNCTION public.drop_slot_workout_session(
  p_slot_id UUID,
  p_trainee_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM training_sessions ts
    WHERE ts.slot_id = p_slot_id
      AND ts.trainee_id = p_trainee_id
      AND ts.slot_workout_synced_at IS NOT NULL
      AND ts.completed_at IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END $$;

REVOKE ALL ON FUNCTION public.drop_slot_workout_session(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_slot_workout_session(UUID, UUID) TO authenticated, service_role;

-- book_slot gains one statement: a trainee who books after the group workout
-- was written still gets it, in the same transaction that takes their seat.
-- Everything else is the function as it runs in production today. It stays
-- SECURITY DEFINER, which is what lets a trainee's own booking write their
-- session, and CREATE OR REPLACE keeps its service_role-only execute grant.
CREATE OR REPLACE FUNCTION public.book_slot(p_slot_id uuid, p_trainee_id uuid, p_trainee_name text, p_plan_starts date, p_plan_ends date, p_sessions_total integer, p_sessions_used integer, p_weekly_cap integer, p_today date)
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

  -- A trainee who books after the group workout was written still gets it,
  -- in this transaction. No-ops when the slot has no group workout.
  PERFORM apply_slot_workout_to_trainee(p_slot_id, p_trainee_id);

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $function$;
