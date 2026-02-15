-- Leads CRM migration
-- Tables for managing leads, contact logs, sent messages, and flow responses

-- =============================================================================
-- Enums
-- =============================================================================

CREATE TYPE lead_status AS ENUM ('new', 'callback', 'in_progress', 'closed', 'disqualified');
CREATE TYPE lead_contact_type AS ENUM ('call', 'whatsapp', 'meeting', 'message_sent');
CREATE TYPE lead_contact_outcome AS ENUM ('interested', 'not_interested', 'callback', 'no_answer');
CREATE TYPE lead_message_type AS ENUM ('template', 'flow', 'text');

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_from_haifa BOOLEAN NOT NULL DEFAULT false,
  status lead_status NOT NULL DEFAULT 'new',
  note TEXT,
  payment NUMERIC,
  months INTEGER,
  total_payment NUMERIC,
  flow_age_group TEXT,
  flow_team TEXT,
  flow_frequency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_id TEXT,
  message_type lead_message_type NOT NULL,
  campaign TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_flow_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  flow_token TEXT UNIQUE,
  screen TEXT,
  data JSONB,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_contact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_type lead_contact_type NOT NULL,
  rep TEXT,
  notes TEXT,
  outcome lead_contact_outcome,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

CREATE INDEX idx_lead_sent_messages_lead_id ON lead_sent_messages(lead_id);
CREATE INDEX idx_lead_flow_responses_lead_id ON lead_flow_responses(lead_id);
CREATE INDEX idx_lead_contact_log_lead_id ON lead_contact_log(lead_id);

-- =============================================================================
-- updated_at trigger
-- =============================================================================

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_flow_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_contact_log ENABLE ROW LEVEL SECURITY;

-- leads
CREATE POLICY "admin_trainer_all" ON leads
  FOR ALL TO authenticated
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

-- lead_sent_messages
CREATE POLICY "admin_trainer_all" ON lead_sent_messages
  FOR ALL TO authenticated
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

-- lead_flow_responses
CREATE POLICY "admin_trainer_all" ON lead_flow_responses
  FOR ALL TO authenticated
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

-- lead_contact_log
CREATE POLICY "admin_trainer_all" ON lead_contact_log
  FOR ALL TO authenticated
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
