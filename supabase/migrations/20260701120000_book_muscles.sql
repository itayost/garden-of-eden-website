-- Muscles taxonomy for the Player Development Book (Feature 1, Part C1).
-- book_muscles: canonical muscle list with Hebrew names and optional emoji.
-- book_drill_muscles: many-to-many join between book_drills and book_muscles.

CREATE TABLE book_muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he TEXT NOT NULL,
  emoji TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE book_drill_muscles (
  drill_id UUID NOT NULL REFERENCES book_drills(id) ON DELETE CASCADE,
  muscle_id UUID NOT NULL REFERENCES book_muscles(id) ON DELETE CASCADE,
  PRIMARY KEY (drill_id, muscle_id)
);
CREATE INDEX idx_book_drill_muscles_muscle ON book_drill_muscles(muscle_id);

-- RLS for book_muscles (readable by any authenticated user, writable by admin+trainer)

ALTER TABLE book_muscles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_muscles_select_authenticated" ON book_muscles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_muscles_write_admin_trainer" ON book_muscles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));

-- RLS for book_drill_muscles (same access model as book_muscles)

ALTER TABLE book_drill_muscles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_drill_muscles_select_authenticated" ON book_drill_muscles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "book_drill_muscles_write_admin_trainer" ON book_drill_muscles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));
