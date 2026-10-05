-- Payment link: an explicit marker on the order (issue #100, PRD #86).
--
-- Expand only. Apply BEFORE deploying the code that writes and reads it; the
-- code running today never does.
--
-- payment_link_by names the staff member who sent the parent a Payment link.
-- It marks the order as one (the agreement page then leads to the card page)
-- and becomes the Plan's created_by once the parent pays. received_by stays
-- for money staff took by hand.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_link_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.payment_link_by IS
  'The staff member who sent this order as a Payment link; NULL for online and hand-taken sales.';

CREATE INDEX IF NOT EXISTS idx_orders_payment_link_by ON public.orders (payment_link_by) WHERE payment_link_by IS NOT NULL;
