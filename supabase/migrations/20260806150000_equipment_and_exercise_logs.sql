-- ===========================================
-- EQUIPMENT (ציוד) + EXERCISE LOGS (רישומי תרגילים)
-- Phase 3 of the studio training pipeline.
--
-- equipment: the studio's machines/stations. Each carries a short unique code
-- printed as a QR sticker encoding /dashboard/scan/<code> — a plain URL the
-- phone's native camera opens; no in-app scanner exists or is needed.
--
-- exercise_logs: what a trainee actually did — one row per exercise
-- (sets/reps/weight), optionally tied to his session exercise and to the
-- equipment he scanned. Logs are RECORDS: no hard delete for anyone.
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name_he TEXT NOT NULL CHECK (name_he <> ''),
  -- Short code embedded in the QR URL. Generated server-side, never edited —
  -- reprinting stickers on every rename would defeat the point.
  code TEXT NOT NULL UNIQUE CHECK (code <> ''),

  is_active BOOLEAN NOT NULL DEFAULT true,
  notes_he TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structured link from library exercises to equipment. The legacy free-text
-- workout_exercises.equipment column stays as a display fallback.
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  trainee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,

  -- Set when the log fulfils a session exercise; NULL for free logs. The log
  -- outlives session edits (SET NULL), because it records what happened.
  session_exercise_id UUID REFERENCES training_session_exercises(id) ON DELETE SET NULL,

  -- The equipment scanned to open the form, when the QR path was used.
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,

  -- One row per exercise, not per set. All nullable — bodyweight work has no
  -- weight, timed work may have no reps — but the app requires at least one.
  sets INTEGER CHECK (sets IS NULL OR (sets >= 1 AND sets <= 99)),
  reps INTEGER CHECK (reps IS NULL OR (reps >= 1 AND reps <= 999)),
  weight_kg NUMERIC(5, 2) CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 500)),

  note_he TEXT,

  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_workout_exercises_equipment
  ON workout_exercises(equipment_id)
  WHERE equipment_id IS NOT NULL;

-- The trainee's today view joins logs by session exercise.
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_exercise
  ON exercise_logs(session_exercise_id)
  WHERE session_exercise_id IS NOT NULL;

-- History per trainee, newest first (staff views, future progress charts).
CREATE INDEX IF NOT EXISTS idx_exercise_logs_trainee_logged
  ON exercise_logs(trainee_id, logged_at DESC);

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

DROP TRIGGER IF EXISTS set_equipment_updated_at ON equipment;
CREATE TRIGGER set_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ROW LEVEL SECURITY — equipment
-- Any signed-in user resolves a scanned code; only admins manage the catalog.
-- ===========================================

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_authenticated_select" ON equipment;
CREATE POLICY "equipment_authenticated_select" ON equipment
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "equipment_admin_write" ON equipment;
CREATE POLICY "equipment_admin_write" ON equipment
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- ===========================================
-- ROW LEVEL SECURITY — exercise_logs
-- A trainee writes and reads his own logs; staff reads all. Logs are records:
-- hard DELETE is blocked for everyone, and a trainee may correct (UPDATE)
-- only his own row.
-- ===========================================

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- trainee_id is pinned to the caller so a log cannot be forged for another
-- trainee via a direct API call.
DROP POLICY IF EXISTS "exercise_logs_trainee_insert_own" ON exercise_logs;
CREATE POLICY "exercise_logs_trainee_insert_own" ON exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (trainee_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "exercise_logs_trainee_select_own" ON exercise_logs;
CREATE POLICY "exercise_logs_trainee_select_own" ON exercise_logs
  FOR SELECT
  TO authenticated
  USING (trainee_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "exercise_logs_trainee_update_own" ON exercise_logs;
CREATE POLICY "exercise_logs_trainee_update_own" ON exercise_logs
  FOR UPDATE
  TO authenticated
  USING (trainee_id = (SELECT auth.uid()))
  WITH CHECK (trainee_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "exercise_logs_staff_select" ON exercise_logs;
CREATE POLICY "exercise_logs_staff_select" ON exercise_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "exercise_logs_no_hard_delete" ON exercise_logs;
CREATE POLICY "exercise_logs_no_hard_delete" ON exercise_logs
  FOR DELETE
  TO authenticated
  USING (false);
