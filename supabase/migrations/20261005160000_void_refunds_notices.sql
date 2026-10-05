-- Void, refund records and trainee notices (issue #93, PRD #86).
--
-- Expand only: a new status value on plans and orders, two new tables. Apply
-- this BEFORE deploying the code, which writes them. The code running today
-- never writes the new values, so it keeps working after this lands.

-- A Plan recorded by mistake and undone, as if never sold.
ALTER TABLE public.trainee_plans
  DROP CONSTRAINT IF EXISTS trainee_plans_status_check,
  ADD CONSTRAINT trainee_plans_status_check CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'voided'::text]));

-- voided: the sale is undone (Void); refunded: money went back after a
-- Cancellation (#94). Neither counts as paid anywhere.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY[
    'pending'::text, 'charging'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'voided'::text, 'refunded'::text
  ]));

-- The audit record of every Void (and later every Cancellation): who, when,
-- why, and how the money went back. The system moves no money; staff issue
-- the Morning credit note by hand and record its number here.
CREATE TABLE IF NOT EXISTS public.plan_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.trainee_plans(id),
  order_id uuid REFERENCES public.orders(id),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['void'::text, 'cancellation'::text])),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 300),
  amount_ils numeric(10,2) NOT NULL CHECK (amount_ils >= 0),
  method text NOT NULL CHECK (method = ANY (ARRAY['card'::text, 'cash'::text, 'transfer'::text, 'bit'::text, 'arbox'::text, 'none'::text])),
  reference text CHECK (reference IS NULL OR char_length(reference) <= 60),
  credit_note_number text CHECK (credit_note_number IS NULL OR char_length(credit_note_number) BETWEEN 1 AND 40),
  credit_note_recorded_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_refunds IS
  'One row per Void or Cancellation: the reason, the actor, and how the money went back. Written only by server actions with the service role.';

-- A Plan is voided once.
CREATE UNIQUE INDEX IF NOT EXISTS plan_refunds_one_void_per_plan ON public.plan_refunds (plan_id) WHERE kind = 'void';
CREATE INDEX IF NOT EXISTS plan_refunds_order_id_idx ON public.plan_refunds (order_id);
CREATE INDEX IF NOT EXISTS plan_refunds_created_by_idx ON public.plan_refunds (created_by);

ALTER TABLE public.plan_refunds ENABLE ROW LEVEL SECURITY;

-- Admins read the audit trail; Branch managers read it through scoped server
-- actions. Nobody writes through the API.
DROP POLICY IF EXISTS plan_refunds_select_admin ON public.plan_refunds;
CREATE POLICY plan_refunds_select_admin ON public.plan_refunds AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin'::user_role);

REVOKE ALL ON public.plan_refunds FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plan_refunds FROM authenticated;

-- In-app notices to a Trainee, such as a Booking cancelled because a Plan
-- was voided. Shown until dismissed.
CREATE TABLE IF NOT EXISTS public.trainee_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_he text NOT NULL CHECK (char_length(body_he) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);

COMMENT ON TABLE public.trainee_notices IS
  'Messages a Trainee sees in the app until dismissed. Written and dismissed only by server actions with the service role.';

CREATE INDEX IF NOT EXISTS trainee_notices_open_idx ON public.trainee_notices (profile_id) WHERE dismissed_at IS NULL;

ALTER TABLE public.trainee_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainee_notices_select_own ON public.trainee_notices;
CREATE POLICY trainee_notices_select_own ON public.trainee_notices AS PERMISSIVE FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

REVOKE ALL ON public.trainee_notices FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.trainee_notices FROM authenticated;
