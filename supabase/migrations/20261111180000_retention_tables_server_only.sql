-- The retention report and its notes are read and written only by server
-- actions, through the service role, after verifyAdminOrTrainer and the
-- caller's branch scope (src/lib/retention/scope.ts). Until now any trainer
-- could select every branch's whole Arbox snapshot from retention_reports, and
-- insert, update or delete any row of retention_notes, straight from the
-- browser with their own session, past that scope. retention_call_log already
-- works this way (20261106140000_call_reminders.sql).
--
-- Deploy order: ship the code that reads these tables with the service role
-- first (fix/retention-scope-by-profile), then push this. The code before it
-- reads them with the user's session and would find nothing.
--
-- No IF EXISTS: a name mismatch must fail, not leave a policy live.

SET LOCAL lock_timeout = '3s';

DROP POLICY "Admin and trainers can read retention reports" ON public.retention_reports;

DROP POLICY "Admin and trainers can read retention notes" ON public.retention_notes;
DROP POLICY "Admin and trainers can create retention notes" ON public.retention_notes;
DROP POLICY "Admin and trainers can update retention notes" ON public.retention_notes;
DROP POLICY "Admin and trainers can delete retention notes" ON public.retention_notes;

ALTER TABLE public.retention_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.retention_reports FROM anon, authenticated;
REVOKE ALL ON public.retention_notes FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('retention_reports', 'retention_notes')
  ) THEN
    RAISE EXCEPTION 'retention_reports / retention_notes still have a policy';
  END IF;
END $$;
