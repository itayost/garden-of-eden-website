-- Re-saving a group workout must not unlink what the trainee already logged.
--
-- exercise_logs.session_exercise_id is ON DELETE SET NULL, so the previous
-- version of apply_slot_workout_to_trainee, which replaced every
-- training_session_exercises row, detached every log the moment a trainer
-- changed one weight: a trainee who had logged three of five exercises would
-- see the whole workout unlogged, and re-logging would write a second row that
-- double-counts in their stats. The refresh path runs on every re-save, so it
-- was reachable mid-session, which is exactly when a trainer adjusts a target.
--
-- Repairing the links afterwards is not available: staff hold SELECT on
-- exercise_logs and no UPDATE policy, and this function is deliberately not
-- SECURITY DEFINER. So the fix is to stop deleting rows that are still
-- prescribed, and merge instead.

-- Makes the merge below well defined. The editor's picker already excludes an
-- exercise that is in the list, so this states an invariant the UI enforced
-- and the schema did not.
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_workout_exercises_unique
  ON public.slot_workout_exercises (slot_id, exercise_id);

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

  -- Merge, never replace. A row for an exercise that is still prescribed keeps
  -- its id, so the logs hanging off it stay attached.

  -- Dropped from the workout: the row goes and its logs unlink, which is
  -- right. That exercise is no longer part of what was prescribed.
  DELETE FROM training_session_exercises tse
    WHERE tse.session_id = v_session_id
      AND NOT EXISTS (
        SELECT 1 FROM slot_workout_exercises e
         WHERE e.slot_id = p_slot_id AND e.exercise_id = tse.exercise_id);

  -- Still prescribed: the targets and the position move, the row does not.
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

  -- Newly added.
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

  -- v_synced is only set when the SELECT above found a row to refresh.
  RETURN CASE WHEN v_synced IS NULL THEN 'create' ELSE 'refresh' END;
END $$;
