-- Cancellation with the policy refund (issue #94, PRD #86).
--
-- Expand only: nullable columns. Apply this BEFORE deploying the code, which
-- reads and writes them. The code running today never touches them, so it
-- keeps working after this lands.

-- The day a Cancellation ended the Plan. The Plan keeps its place in the
-- queue up to that day (and the sessions it used); a cancelled Plan without
-- it is an older, hidden cancellation.
ALTER TABLE public.trainee_plans
  ADD COLUMN IF NOT EXISTS ended_on date;

ALTER TABLE public.trainee_plans
  DROP CONSTRAINT IF EXISTS trainee_plans_ended_on_check,
  ADD CONSTRAINT trainee_plans_ended_on_check CHECK (ended_on IS NULL OR status = 'cancelled');

COMMENT ON COLUMN public.trainee_plans.ended_on IS
  'The day a Cancellation ended the Plan; the Plan queue runs it up to that day.';

-- What the policy proposed, and why staff gave a different amount.
ALTER TABLE public.plan_refunds
  ADD COLUMN IF NOT EXISTS proposed_amount_ils numeric(10,2) CHECK (proposed_amount_ils IS NULL OR proposed_amount_ils >= 0),
  ADD COLUMN IF NOT EXISTS override_reason text CHECK (override_reason IS NULL OR char_length(override_reason) BETWEEN 2 AND 300),
  ADD COLUMN IF NOT EXISTS defect boolean NOT NULL DEFAULT false;

-- A refund that differs from the proposal always says why.
ALTER TABLE public.plan_refunds
  DROP CONSTRAINT IF EXISTS plan_refunds_override_has_reason,
  ADD CONSTRAINT plan_refunds_override_has_reason CHECK (
    proposed_amount_ils IS NULL OR amount_ils = proposed_amount_ils OR override_reason IS NOT NULL
  );

-- A Plan is cancelled once.
CREATE UNIQUE INDEX IF NOT EXISTS plan_refunds_one_cancellation_per_plan ON public.plan_refunds (plan_id) WHERE kind = 'cancellation';

-- The value of one session in a branch's price list: what a used session on
-- a cancelled Card costs. Admins only (branches_write_admin). When unset the
-- 10-Card per-session rate applies.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS single_session_price_ils numeric(10,2) CHECK (single_session_price_ils IS NULL OR single_session_price_ils > 0);

COMMENT ON COLUMN public.branches.single_session_price_ils IS
  'Single-session price (מחיר אימון בודד) for Card refunds; null means the 10-Card per-session rate.';
