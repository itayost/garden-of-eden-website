-- One plan per paid order. Fulfillment reads-then-inserts; two concurrent
-- webhook deliveries or a retry racing a delivery could otherwise create two
-- plans from one payment. The webhook now also claims the order first, but
-- the index is the guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS trainee_plans_order_id_key
  ON public.trainee_plans (order_id)
  WHERE order_id IS NOT NULL;
