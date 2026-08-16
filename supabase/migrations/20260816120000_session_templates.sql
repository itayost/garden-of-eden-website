-- ===========================================
-- SESSION TEMPLATES (תבניות אימון)
--
-- A named, reusable single-day exercise list with its targets. A trainer
-- composes a session for one trainee, saves it as a template, and loads it
-- into any other trainee's day.
--
-- NOT a Program. workout_programs is a multi-week grid whose cells carry only
-- sets / reps_he / load_he / notes_he — it cannot store the four numeric
-- targets or the equipment link, so a template stored as a 1-week program
-- would silently discard the whole performance-profile feature on every save
-- and load. This table pair mirrors training_session_exercises instead, so a
-- template comes back exactly as it was saved.
--
-- Staff-only, like workout_programs: a template is an authoring artifact and
-- is never assigned to a trainee. Trainees see Training sessions, not the
-- templates they were built from.
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL CHECK (name <> ''),
  description TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  -- Denormalized snapshot so the template survives author renames/deletions,
  -- same idiom as training_sessions.built_by_name.
  created_by_name TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  template_id UUID NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,

  order_index INTEGER NOT NULL DEFAULT 0,

  -- Column-for-column the same targets a session exercise carries. Free text
  -- and numeric sit beside each other, not instead of each other: "8-10" and
  -- "עד כשל" are not numbers and should not have to be.
  target_sets INTEGER,
  target_reps_he TEXT,
  target_load_he TEXT,
  target_reps INTEGER,
  target_weight_kg NUMERIC(5, 2),
  target_duration_seconds INTEGER,
  target_distance_m INTEGER,
  notes_he TEXT
);

-- ===========================================
-- LENGTH + RANGE GUARDS
-- The same bounds the Zod schemas enforce, restated at the DB layer.
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_templates_name_length') THEN
    ALTER TABLE session_templates ADD CONSTRAINT session_templates_name_length
      CHECK (char_length(name) <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_templates_description_length') THEN
    ALTER TABLE session_templates ADD CONSTRAINT session_templates_description_length
      CHECK (description IS NULL OR char_length(description) <= 300);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_template_exercises_targets_range') THEN
    ALTER TABLE session_template_exercises ADD CONSTRAINT session_template_exercises_targets_range
      CHECK (
        (target_reps IS NULL OR (target_reps >= 1 AND target_reps <= 999))
        AND (target_weight_kg IS NULL OR (target_weight_kg >= 0 AND target_weight_kg <= 500))
        AND (target_duration_seconds IS NULL OR (target_duration_seconds >= 1 AND target_duration_seconds <= 86400))
        AND (target_distance_m IS NULL OR (target_distance_m >= 1 AND target_distance_m <= 100000))
      );
  END IF;
END $$;

-- ===========================================
-- INDEXES
-- ===========================================

-- The list page orders by most recently touched.
CREATE INDEX IF NOT EXISTS idx_session_templates_updated
  ON session_templates(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_template_exercises_template
  ON session_template_exercises(template_id, order_index);

-- ===========================================
-- UPDATED_AT TRIGGER (shared helper, defined in the training_sessions migration)
-- ===========================================

DROP TRIGGER IF EXISTS set_session_templates_updated_at ON session_templates;
CREATE TRIGGER set_session_templates_updated_at
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ATOMIC EXERCISE-LIST REPLACE
-- Same idiom as replace_session_exercises: one plpgsql function = one
-- transaction, so a failure can never leave a template with a lost or partial
-- exercise list. SECURITY INVOKER — RLS still applies.
-- ===========================================

CREATE OR REPLACE FUNCTION replace_template_exercises(p_template_id UUID, p_exercises JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM session_template_exercises WHERE template_id = p_template_id;

  INSERT INTO session_template_exercises
    (template_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he,
     target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT
    p_template_id,
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
-- ROW LEVEL SECURITY
-- Staff (admin + trainer) manage templates, matching workout_programs.
-- Trainees get no policy at all: a template is never assigned, and what a
-- trainee needs to see is the Training session built from it.
-- ===========================================

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_template_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_templates_staff_all" ON session_templates;
CREATE POLICY "session_templates_staff_all" ON session_templates
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

DROP POLICY IF EXISTS "session_template_exercises_staff_all" ON session_template_exercises;
CREATE POLICY "session_template_exercises_staff_all" ON session_template_exercises
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
