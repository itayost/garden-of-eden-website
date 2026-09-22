-- A session belongs to a slot, not to a day (spec 2026-09-22).
--
-- UNIQUE (trainee_id, session_date) made a workout a property of a day, but a
-- group workout is a property of an hour. A trainee booked into two hours got
-- one workout, whichever was saved first, and the second slot's fan-out
-- returned skip_other_slot. The client's decision: two hours, two workouts.
--
-- This also closes an edge the group-workout PR left open. With one session
-- shared between two slots, cancelling the first deleted it and nothing
-- re-applied the second slot's workout. With nothing shared there is nothing
-- to take by mistake.

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_trainee_id_session_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_trainee_slot_key
  ON public.training_sessions (trainee_id, slot_id) WHERE slot_id IS NOT NULL;

-- Deliberately NO unique index on the slotless case. slot_id is ON DELETE SET
-- NULL, so deleting a slot turns its sessions slotless, and a trainee who
-- already had a slotless session that day would make the slot deletion fail on
-- a unique violation nobody could read. ON DELETE CASCADE would avoid that by
-- destroying an individually built session on a slot delete, which is worse.
-- Slotless sessions are the rare shape (one row in the whole table) and
-- upsertSessionAction reuses the most recent one, so nothing accumulates.

-- The fan-out now finds a session by slot rather than by date, and has no
-- other-slot case left to refuse.
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

  -- By slot, not by date. This is the whole change.
  SELECT ts.id, ts.slot_workout_synced_at, ts.completed_at
    INTO v_session_id, v_synced, v_completed
    FROM training_sessions ts
    WHERE ts.trainee_id = p_trainee_id AND ts.slot_id = p_slot_id;

  IF v_session_id IS NOT NULL THEN
    IF v_completed IS NOT NULL THEN RETURN 'skip_completed'; END IF;
    IF v_synced IS NULL THEN RETURN 'skip_custom'; END IF;

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

  -- Merged, never replaced: exercise_logs.session_exercise_id is ON DELETE SET
  -- NULL, so dropping and re-inserting would unlink everything the trainee had
  -- already logged. Unchanged from the previous migration.
  DELETE FROM training_session_exercises tse
    WHERE tse.session_id = v_session_id
      AND NOT EXISTS (
        SELECT 1 FROM slot_workout_exercises e
         WHERE e.slot_id = p_slot_id AND e.exercise_id = tse.exercise_id);

  UPDATE training_session_exercises tse
     SET order_index = e.order_index,
         target_sets = e.target_sets,
         target_reps_he = e.target_reps_he,
         target_load_he = e.target_load_he,
         notes_he = e.notes_he,
         target_reps = e.target_reps,
         target_weight_kg = e.target_weight_kg,
         target_duration_seconds = e.target_duration_seconds,
         target_distance_m = e.target_distance_m
    FROM slot_workout_exercises e
   WHERE tse.session_id = v_session_id
     AND e.slot_id = p_slot_id
     AND e.exercise_id = tse.exercise_id;

  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he,
     notes_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT v_session_id, e.exercise_id, e.order_index, e.target_sets, e.target_reps_he,
         e.target_load_he, e.notes_he, e.target_reps, e.target_weight_kg,
         e.target_duration_seconds, e.target_distance_m
    FROM slot_workout_exercises e
   WHERE e.slot_id = p_slot_id
     AND NOT EXISTS (
       SELECT 1 FROM training_session_exercises tse
        WHERE tse.session_id = v_session_id AND tse.exercise_id = e.exercise_id)
   ORDER BY e.order_index;

  RETURN CASE WHEN v_synced IS NULL THEN 'create' ELSE 'refresh' END;
END $$;
