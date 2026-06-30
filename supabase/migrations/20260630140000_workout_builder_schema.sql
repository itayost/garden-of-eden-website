-- Trainer Workout Builder (Feature 2). Admin + trainer only (no trainee access).

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category TEXT NOT NULL,
  sub_category TEXT,
  name_he TEXT,
  name_en TEXT,
  equipment TEXT,
  cues_he TEXT,
  goal_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workout_exercises_category ON workout_exercises(main_category, sub_category);

CREATE TABLE workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weeks INTEGER NOT NULL DEFAULT 1 CHECK (weeks >= 1 AND weeks <= 52),
  periodization_type TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workout_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes_he TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workout_program_exercises_program ON workout_program_exercises(program_id, order_index);

CREATE TABLE workout_program_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_exercise_id UUID NOT NULL REFERENCES workout_program_exercises(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  sets INTEGER,
  reps_he TEXT,
  load_he TEXT,
  notes_he TEXT,
  UNIQUE (program_exercise_id, week_number)
);
CREATE INDEX idx_workout_program_cells_pe ON workout_program_cells(program_exercise_id, week_number);

-- RLS policies for admin + trainer access (read AND write)

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_exercises_admin_trainer_all" ON workout_exercises
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_programs_admin_trainer_all" ON workout_programs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE workout_program_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_program_exercises_admin_trainer_all" ON workout_program_exercises
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE workout_program_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_program_cells_admin_trainer_all" ON workout_program_cells
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));
