-- ===========================================
-- TRAINING SESSIONS (שיבוץ אימונים) — Phase 2 of the studio training pipeline
--
-- A training session is the per-trainee plan for ONE calendar day, built by a
-- trainer from the workout_exercises library. It is not a Slot (the group
-- plan) and not a Program (a multi-week template — programs serve as copy
-- sources here, never as assignments).
--
-- FIRST TRAINEE-READABLE WORKOUT DATA: until now every workout table was
-- staff-only. Trainees get SELECT on their own sessions and on the exercise
-- library — deliberately scoped for Phase 3 (the trainee "today" view).
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  trainee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,

  -- The schedule slot this session was built from, when built via the
  -- schedule page. Informational; the session survives slot deletion.
  slot_id UUID REFERENCES daily_schedule_slots(id) ON DELETE SET NULL,

  built_by UUID NOT NULL REFERENCES profiles(id),
  -- Denormalized snapshot so the session survives builder renames/deletions.
  built_by_name TEXT NOT NULL,

  notes_he TEXT,

  -- Set in Phase 3 when the trainee finishes logging. NULL = not completed.
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One session per trainee per day. Building again edits the same session.
  UNIQUE (trainee_id, session_date)
);

CREATE TABLE IF NOT EXISTS training_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,

  order_index INTEGER NOT NULL DEFAULT 0,

  -- Targets the trainer prescribes. Reps and load are free text, matching
  -- workout_program_cells ("8-10", "עד כשל").
  target_sets INTEGER,
  target_reps_he TEXT,
  target_load_he TEXT,
  notes_he TEXT
);

-- ===========================================
-- INDEXES
-- ===========================================

-- The schedule page loads all sessions for one day.
CREATE INDEX IF NOT EXISTS idx_training_sessions_date
  ON training_sessions(session_date);

-- "Previous session of this trainee" lookup for the duplicate feature.
-- Also serves the UNIQUE constraint's queries.
CREATE INDEX IF NOT EXISTS idx_training_sessions_trainee_date
  ON training_sessions(trainee_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_training_session_exercises_session
  ON training_session_exercises(session_id, order_index);

-- ===========================================
-- UPDATED_AT TRIGGER (shared helper)
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_training_sessions_updated_at ON training_sessions;
CREATE TRIGGER set_training_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ATOMIC EXERCISE-LIST REPLACE
-- Same idiom as replace_slot_roster / save_workout_program_grid: one plpgsql
-- function = one transaction, so a failure can never leave a session with a
-- lost or partial exercise list. SECURITY INVOKER — RLS still applies.
-- ===========================================

CREATE OR REPLACE FUNCTION replace_session_exercises(p_session_id UUID, p_exercises JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM training_session_exercises WHERE session_id = p_session_id;

  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he)
  SELECT
    p_session_id,
    (elem->>'exercise_id')::uuid,
    (elem->>'order_index')::int,
    NULLIF(elem->>'target_sets', '')::int,
    NULLIF(elem->>'target_reps_he', ''),
    NULLIF(elem->>'target_load_he', ''),
    NULLIF(elem->>'notes_he', '')
  FROM jsonb_array_elements(p_exercises) AS elem;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- ROW LEVEL SECURITY
-- Staff (admin + trainer) manage sessions — trainers BUILD sessions, unlike
-- the schedule where only admins write. Trainees read their own.
-- ===========================================

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_session_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_sessions_staff_all" ON training_sessions;
CREATE POLICY "training_sessions_staff_all" ON training_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- A trainee reads his own session. Write stays staff-only; Phase 3 adds a
-- narrow completion path, not a general trainee write.
DROP POLICY IF EXISTS "training_sessions_trainee_select_own" ON training_sessions;
CREATE POLICY "training_sessions_trainee_select_own" ON training_sessions
  FOR SELECT
  TO authenticated
  USING (trainee_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "training_session_exercises_staff_all" ON training_session_exercises;
CREATE POLICY "training_session_exercises_staff_all" ON training_session_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "training_session_exercises_trainee_select_own" ON training_session_exercises;
CREATE POLICY "training_session_exercises_trainee_select_own" ON training_session_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions
      WHERE id = session_id
      AND trainee_id = (SELECT auth.uid())
    )
  );

-- The exercise library becomes readable by any signed-in user: a trainee must
-- see the names/cues of exercises in his session, and library content is not
-- sensitive. Writes stay behind the existing admin/trainer FOR ALL policy.
DROP POLICY IF EXISTS "workout_exercises_authenticated_select" ON workout_exercises;
CREATE POLICY "workout_exercises_authenticated_select" ON workout_exercises
  FOR SELECT
  TO authenticated
  USING (true);
