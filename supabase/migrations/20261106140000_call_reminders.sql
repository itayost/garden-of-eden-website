-- Click-to-call reminders (issue #164),
-- spec docs/superpowers/specs/2026-11-06-click-to-call-design.md.
--
-- Expand only: two new tables and one nullable column. Apply this BEFORE
-- deploying the code, which reads and writes them; the code running today
-- never touches them. Safe to run twice.
--
-- call_attempts records each tap on a call link. Whether an attempt is
-- documented is derived from lead_contact_log / retention_call_log rows by the
-- same author written at or after started_at, so documentation never writes
-- here. Both new tables are read and written only by server actions with the
-- service role: RLS is on with no policies, and anon and authenticated have no
-- grants.

SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  report_month date,
  trainee_phone text,
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 200),
  started_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  CONSTRAINT call_attempts_one_target CHECK (
    (lead_id IS NOT NULL AND report_month IS NULL AND trainee_phone IS NULL)
    OR (
      lead_id IS NULL
      AND report_month IS NOT NULL
      AND trainee_phone ~ '^\+972[0-9]{9}$'
    )
  )
);

CREATE INDEX IF NOT EXISTS call_attempts_caller_started_idx
  ON public.call_attempts (caller_id, started_at);
CREATE INDEX IF NOT EXISTS call_attempts_lead_id_idx
  ON public.call_attempts (lead_id);

COMMENT ON TABLE public.call_attempts IS
  'One row per tap on a call link. Documentation is derived from lead_contact_log / retention_call_log by the same author after started_at.';

CREATE TABLE IF NOT EXISTS public.retention_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month date NOT NULL,
  trainee_phone text NOT NULL CHECK (trainee_phone ~ '^\+972[0-9]{9}$'),
  trainee_name text NOT NULL CHECK (char_length(trainee_name) BETWEEN 1 AND 200),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome public.lead_contact_outcome NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retention_call_log_phone_created_idx
  ON public.retention_call_log (trainee_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS retention_call_log_author_created_idx
  ON public.retention_call_log (author_id, created_at);

COMMENT ON TABLE public.retention_call_log IS
  'Calls documented from customer retention. Separate from retention_notes, whose edits are not call documentation.';

ALTER TABLE public.lead_contact_log
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lead_contact_log_author_created_idx
  ON public.lead_contact_log (author_id, created_at);

COMMENT ON COLUMN public.lead_contact_log.author_id IS
  'Staff member who wrote the entry; NULL for entries written before 2026-11-06.';

ALTER TABLE public.call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_call_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.call_attempts FROM anon, authenticated;
REVOKE ALL ON public.retention_call_log FROM anon, authenticated;
