-- A plan paid in Arbox is recorded as a paid manual order with method 'arbox':
-- it keeps the orders list the full history of plans, while no Morning receipt
-- is issued for it (Arbox already issued one). Additive: the old values stay.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'bit'::text, 'card'::text, 'arbox'::text]));
