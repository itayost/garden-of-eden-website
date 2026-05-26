CREATE TABLE lead_tabs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT lead_tabs_slug_format CHECK (slug ~ '^[a-z0-9_-]{1,50}$')
);

CREATE UNIQUE INDEX lead_tabs_one_default_idx
  ON lead_tabs (is_default)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX lead_tabs_position_idx
  ON lead_tabs (position)
  WHERE deleted_at IS NULL;

ALTER TABLE lead_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_trainer_select" ON lead_tabs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'trainer')
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_insert" ON lead_tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_update" ON lead_tabs
  FOR UPDATE TO authenticated
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

CREATE TRIGGER update_lead_tabs_updated_at
  BEFORE UPDATE ON lead_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO lead_tabs (slug, name, position, is_default) VALUES
  ('paid',    'ממומנים',  0, true),
  ('organic', 'אורגניים', 1, false);

ALTER TABLE leads
  ADD COLUMN tab_id UUID REFERENCES lead_tabs(id) ON DELETE RESTRICT;

UPDATE leads
SET tab_id = (SELECT id FROM lead_tabs WHERE slug = leads.source);

ALTER TABLE leads
  ALTER COLUMN tab_id SET NOT NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_source_check;

CREATE INDEX leads_tab_id_idx ON leads (tab_id);
