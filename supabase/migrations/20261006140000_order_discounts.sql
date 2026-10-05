-- Discount on a single sale (issue #99, PRD #86).
--
-- Expand only: three nullable columns. Apply BEFORE deploying the code that
-- writes them; the code running today never reads them.
--
-- amount_ils stays the amount actually paid (receipt, agreement, refunds).
-- A discounted sale also keeps the list price, why, and who gave it; a sale
-- at list price leaves all three empty.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS list_price_ils numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discounted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_discount_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_discount_check CHECK (
  (list_price_ils IS NULL AND discount_reason IS NULL AND discounted_by IS NULL)
  OR (
    list_price_ils > amount_ils
    AND discount_reason IS NOT NULL
    AND char_length(discount_reason) BETWEEN 2 AND 300
  )
);

COMMENT ON COLUMN public.orders.list_price_ils IS
  'The product''s list price when the sale was discounted; NULL when sold at list price. amount_ils is what was paid.';

CREATE INDEX IF NOT EXISTS idx_orders_discounted_by ON public.orders (discounted_by) WHERE discounted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_discounted ON public.orders (created_at DESC) WHERE list_price_ils IS NOT NULL;
