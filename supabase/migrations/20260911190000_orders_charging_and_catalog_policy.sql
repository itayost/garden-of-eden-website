-- 'charging' marks an order whose card is at the acquirer right now. The
-- charge action claims the row into this state before calling out, so a
-- second submit (double tap, second tab, retry) finds nothing to claim and
-- cannot charge the card again.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'charging', 'paid', 'failed', 'expired'));

-- Unlaunched or retired products are not public. Admin reads use the
-- service role, so this only narrows the anon and authenticated view.
DROP POLICY IF EXISTS "plan_products_select_public" ON public.plan_products;
CREATE POLICY "plan_products_select_public" ON public.plan_products
  FOR SELECT TO anon, authenticated USING (is_active);
