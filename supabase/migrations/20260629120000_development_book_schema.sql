-- Player Development Book schema (Feature 1).
-- Content tables readable by any authenticated user, writable by admin+trainer.
-- Progress owned by the user; insert fires the existing streak engine.

CREATE TABLE book_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE book_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES book_categories(id) ON DELETE CASCADE,
  number INTEGER,
  slug TEXT UNIQUE NOT NULL,
  name_he TEXT NOT NULL,
  subtitle_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_all_positions BOOLEAN NOT NULL DEFAULT false,
  age_metric_label TEXT,
  report_text_he TEXT,
  report_highlight_he TEXT,
  verbal_text_he TEXT,
  verbal_tip_he TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_book_parameters_category ON book_parameters(category_id, order_index);

CREATE TABLE book_parameter_positions (
  parameter_id UUID NOT NULL REFERENCES book_parameters(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  PRIMARY KEY (parameter_id, position)
);

CREATE TABLE book_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id UUID NOT NULL REFERENCES book_parameters(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT,
  name_he TEXT,
  muscle_he TEXT,
  sets_he TEXT,
  how_he TEXT,
  why_he TEXT,
  connect_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_book_drills_parameter ON book_drills(parameter_id, order_index);

CREATE TABLE book_age_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id UUID NOT NULL REFERENCES book_parameters(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL,
  what_he TEXT,
  metric_value_he TEXT,
  recovery_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_book_age_rows_parameter ON book_age_rows(parameter_id, order_index);

CREATE TABLE book_drill_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL UNIQUE REFERENCES book_drills(id) ON DELETE CASCADE,
  situation_label_he TEXT,
  subtitle_he TEXT,
  age_min_label TEXT,
  level_label TEXT,
  golden_rule_he TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE book_drill_card_failure_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES book_drill_cards(id) ON DELETE CASCADE,
  text_he TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_book_failure_steps_card ON book_drill_card_failure_steps(card_id, order_index);

CREATE TABLE book_drill_card_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES book_drill_cards(id) ON DELETE CASCADE,
  number INTEGER,
  name_he TEXT NOT NULL,
  subtitle_he TEXT,
  drill_note_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_book_phases_card ON book_drill_card_phases(card_id, order_index);

CREATE TABLE book_drill_card_phase_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES book_drill_card_phases(id) ON DELETE CASCADE,
  text_he TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_book_phase_points_phase ON book_drill_card_phase_points(phase_id, order_index);

CREATE TABLE book_drill_card_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES book_drill_cards(id) ON DELETE CASCADE,
  label_he TEXT NOT NULL,
  before_he TEXT,
  target_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_book_metrics_card ON book_drill_card_metrics(card_id, order_index);

CREATE TABLE book_drill_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  drill_id UUID NOT NULL REFERENCES book_drills(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'done',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, drill_id)
);
CREATE INDEX idx_book_drill_progress_user ON book_drill_progress(user_id);

-- Streak integration: reuse update_user_streak() from migration 006.
CREATE OR REPLACE FUNCTION trigger_streak_book_drill()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' THEN
    PERFORM update_user_streak(NEW.user_id, NEW.completed_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER streak_after_book_drill_insert
  AFTER INSERT ON book_drill_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_streak_book_drill();

-- RLS for content tables (readable by authenticated users, writable by admin+trainer)

ALTER TABLE book_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_categories_select_authenticated" ON book_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_categories_write_admin_trainer" ON book_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_parameters_select_authenticated" ON book_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_parameters_write_admin_trainer" ON book_parameters
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_parameter_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_parameter_positions_select_authenticated" ON book_parameter_positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_parameter_positions_write_admin_trainer" ON book_parameter_positions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drills_select_authenticated" ON book_drills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drills_write_admin_trainer" ON book_drills
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_age_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_age_rows_select_authenticated" ON book_age_rows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_age_rows_write_admin_trainer" ON book_age_rows
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drill_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_cards_select_authenticated" ON book_drill_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_cards_write_admin_trainer" ON book_drill_cards
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drill_card_failure_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_card_failure_steps_select_authenticated" ON book_drill_card_failure_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_card_failure_steps_write_admin_trainer" ON book_drill_card_failure_steps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drill_card_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_card_phases_select_authenticated" ON book_drill_card_phases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_card_phases_write_admin_trainer" ON book_drill_card_phases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drill_card_phase_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_card_phase_points_select_authenticated" ON book_drill_card_phase_points
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_card_phase_points_write_admin_trainer" ON book_drill_card_phase_points
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

ALTER TABLE book_drill_card_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_card_metrics_select_authenticated" ON book_drill_card_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_card_metrics_write_admin_trainer" ON book_drill_card_metrics
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

-- RLS for progress table (owner-only access)

ALTER TABLE book_drill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_progress_owner_all" ON book_drill_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
