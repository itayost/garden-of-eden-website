-- ===========================================
-- EQUIPMENT PERFORMANCE PROFILE
-- Phase 4 of the studio training pipeline.
--
-- Until now `equipment` knew a name and a code and nothing about how the
-- machine is used, so every log form in the studio was identical: sets, reps
-- and weight, hardcoded. A jump rope asked a ten-year-old how much he lifted.
--
-- A machine now declares WHAT IS MEASURABLE on it (weight / reps / time /
-- distance), sensible STARTING NUMBERS, and for weight the actual STACK
-- (min, max, increment). An exercise may override the numbers; NULL means
-- inherit. Those two together drive the trainer's target inputs and the
-- trainee's log form.
--
-- BACKWARD COMPATIBILITY IS THE POINT OF THE DEFAULTS: tracks_weight and
-- tracks_reps default true, tracks_duration and tracks_distance default
-- false, which reproduces today's form exactly. No backfill, no regression,
-- and an exercise with no equipment at all keeps the current behaviour.
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

-- ===========================================
-- 1. equipment — the performance profile
-- ===========================================

ALTER TABLE equipment
  -- What the machine can measure. At least one must be true (CHECK below).
  ADD COLUMN IF NOT EXISTS tracks_weight   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracks_reps     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracks_duration BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracks_distance BOOLEAN NOT NULL DEFAULT false,

  -- Starting numbers. Ranges mirror exercise_logs so a default can never be
  -- a value the trainee is then forbidden from logging.
  ADD COLUMN IF NOT EXISTS default_sets             INTEGER,
  ADD COLUMN IF NOT EXISTS default_reps             INTEGER,
  ADD COLUMN IF NOT EXISTS default_weight_kg        NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS default_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS default_distance_m       INTEGER,

  -- The weight stack. Drives the stepper increment and clamps the input, so
  -- a mistyped 200 on a 60kg machine is rejected before it is stored.
  ADD COLUMN IF NOT EXISTS weight_min_kg  NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS weight_max_kg  NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS weight_step_kg NUMERIC(5, 2) NOT NULL DEFAULT 2.5,

  -- Setup notes for THE MACHINE (seat height, pin position). Distinct from
  -- workout_exercises.cues_he, which is how to perform the exercise.
  ADD COLUMN IF NOT EXISTS howto_he TEXT;

-- CHECKs mirror the Zod caps. The anon key sits in every staff browser, so
-- PostgREST is a real write surface and the DB has to bound these itself.
-- Added separately from the ALTER above: ADD CONSTRAINT has no IF NOT EXISTS
-- in the Postgres versions this project targets, so each is guarded.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_tracks_at_least_one') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_tracks_at_least_one
      CHECK (tracks_weight OR tracks_reps OR tracks_duration OR tracks_distance);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_default_sets_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_default_sets_range
      CHECK (default_sets IS NULL OR (default_sets >= 1 AND default_sets <= 99));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_default_reps_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_default_reps_range
      CHECK (default_reps IS NULL OR (default_reps >= 1 AND default_reps <= 999));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_default_weight_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_default_weight_range
      CHECK (default_weight_kg IS NULL OR (default_weight_kg >= 0 AND default_weight_kg <= 500));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_default_duration_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_default_duration_range
      CHECK (default_duration_seconds IS NULL OR (default_duration_seconds >= 1 AND default_duration_seconds <= 86400));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_default_distance_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_default_distance_range
      CHECK (default_distance_m IS NULL OR (default_distance_m >= 1 AND default_distance_m <= 100000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_weight_bounds') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_weight_bounds
      CHECK (
        (weight_min_kg IS NULL OR (weight_min_kg >= 0 AND weight_min_kg <= 500))
        AND (weight_max_kg IS NULL OR (weight_max_kg >= 0 AND weight_max_kg <= 500))
        AND (weight_min_kg IS NULL OR weight_max_kg IS NULL OR weight_min_kg <= weight_max_kg)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_weight_step_range') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_weight_step_range
      CHECK (weight_step_kg > 0 AND weight_step_kg <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_howto_length') THEN
    ALTER TABLE equipment ADD CONSTRAINT equipment_howto_length
      CHECK (howto_he IS NULL OR char_length(howto_he) <= 1000);
  END IF;
END $$;

-- ===========================================
-- 2. workout_exercises — the per-exercise override
--
-- NULL means inherit from the linked equipment. A cable tower hosts a row, a
-- curl and a pushdown; they share a machine but not a rep scheme.
-- ===========================================

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS default_sets             INTEGER,
  ADD COLUMN IF NOT EXISTS default_reps             INTEGER,
  ADD COLUMN IF NOT EXISTS default_weight_kg        NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS default_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS default_distance_m       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_exercises_defaults_range') THEN
    ALTER TABLE workout_exercises ADD CONSTRAINT workout_exercises_defaults_range
      CHECK (
        (default_sets IS NULL OR (default_sets >= 1 AND default_sets <= 99))
        AND (default_reps IS NULL OR (default_reps >= 1 AND default_reps <= 999))
        AND (default_weight_kg IS NULL OR (default_weight_kg >= 0 AND default_weight_kg <= 500))
        AND (default_duration_seconds IS NULL OR (default_duration_seconds >= 1 AND default_duration_seconds <= 86400))
        AND (default_distance_m IS NULL OR (default_distance_m >= 1 AND default_distance_m <= 100000))
      );
  END IF;
END $$;

-- ===========================================
-- 3. exercise_logs — the two measures a trainee could not record
-- ===========================================

ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS distance_m       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercise_logs_duration_range') THEN
    ALTER TABLE exercise_logs ADD CONSTRAINT exercise_logs_duration_range
      CHECK (duration_seconds IS NULL OR (duration_seconds >= 1 AND duration_seconds <= 86400));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercise_logs_distance_range') THEN
    ALTER TABLE exercise_logs ADD CONSTRAINT exercise_logs_distance_range
      CHECK (distance_m IS NULL OR (distance_m >= 1 AND distance_m <= 100000));
  END IF;
END $$;

-- ===========================================
-- 4. training_session_exercises — numeric targets BESIDE the free text
--
-- target_reps_he / target_load_he stay: "8-10" and "עד כשל" are not numbers
-- and should not have to be. The numeric columns are what makes an
-- actual-vs-target comparison possible where the trainer did give a number.
-- ===========================================

ALTER TABLE training_session_exercises
  ADD COLUMN IF NOT EXISTS target_reps             INTEGER,
  ADD COLUMN IF NOT EXISTS target_weight_kg        NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS target_distance_m       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_session_exercises_targets_range') THEN
    ALTER TABLE training_session_exercises ADD CONSTRAINT training_session_exercises_targets_range
      CHECK (
        (target_reps IS NULL OR (target_reps >= 1 AND target_reps <= 999))
        AND (target_weight_kg IS NULL OR (target_weight_kg >= 0 AND target_weight_kg <= 500))
        AND (target_duration_seconds IS NULL OR (target_duration_seconds >= 1 AND target_duration_seconds <= 86400))
        AND (target_distance_m IS NULL OR (target_distance_m >= 1 AND target_distance_m <= 100000))
      );
  END IF;
END $$;

-- ===========================================
-- 5. replace_session_exercises — carry the new targets
--
-- The session builder writes exclusively through this RPC, so a column the
-- function does not project is a column the builder can never save. Same
-- body as before plus the four numeric targets.
-- ===========================================

CREATE OR REPLACE FUNCTION replace_session_exercises(p_session_id UUID, p_exercises JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM training_session_exercises WHERE session_id = p_session_id;

  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he,
     target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT
    p_session_id,
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
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- NO RLS CHANGES
--
-- equipment_authenticated_select already exposes the catalog to every signed
-- in user, which is exactly what the trainee's log form needs to read the
-- profile. equipment_admin_write still gates the catalog to admins. The new
-- columns inherit both policies.
-- ===========================================
