-- Early end (issue #95, PRD #86).
--
-- An Early end ends the Current plan today so the Queued plan behind it
-- starts today. The Plan stays 'active' with ended_on set; a Cancellation
-- sets 'cancelled' with ended_on. A voided Plan never has one.
--
-- Expand only. Apply this BEFORE deploying the code that writes ended_on on
-- an active Plan; the code running today never does, so it keeps working.
ALTER TABLE public.trainee_plans
  DROP CONSTRAINT IF EXISTS trainee_plans_ended_on_check,
  ADD CONSTRAINT trainee_plans_ended_on_check CHECK (ended_on IS NULL OR status = ANY (ARRAY['cancelled'::text, 'active'::text]));

COMMENT ON COLUMN public.trainee_plans.ended_on IS
  'The day a Cancellation (status cancelled) or an Early end (status active) ended the Plan; the Plan queue runs it up to that day.';
