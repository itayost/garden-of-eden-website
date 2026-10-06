-- A Plan registered without charging (owner's request, 2026-10-06): payment
-- method 'free', amount 0, the Plan's worth and the reason kept in the
-- Discount columns (list_price_ils, discount_reason, discounted_by), so the
-- orders list shows it like any sale below list price.
--
-- Expand only. Apply BEFORE deploying the code that records free sales.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (
  payment_method IS NULL
  OR payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'bit'::text, 'card'::text, 'arbox'::text, 'free'::text])
);

-- Every order costs something, except one registered without charging.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amount_ils_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_amount_ils_check CHECK (
  amount_ils > 0 OR (amount_ils = 0 AND payment_method = 'free')
);
