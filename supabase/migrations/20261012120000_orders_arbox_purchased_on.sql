-- The day an Arbox purchase was made. The nightly import's paid_at is the
-- night it ran, so income reports date Arbox money by this column instead.
-- NULL for app sales and for hand-entered Arbox repairs (those fall back to
-- the Israel day of paid_at).
ALTER TABLE public.orders ADD COLUMN arbox_purchased_on date;

ALTER TABLE public.orders ADD CONSTRAINT orders_arbox_purchased_on_check
  CHECK (arbox_purchased_on IS NULL OR payment_method = 'arbox');

-- Backfill from the Plan note the import writes:
--   "Arbox import <item> <YYYY-MM-DD> (<membership id>)"
-- Counts first, so the original state is on record before the UPDATE.
DO $$
DECLARE
  matched integer;
  unmatched integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE tp.note ~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$'),
    count(*) FILTER (WHERE tp.note IS NULL OR tp.note !~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$')
  INTO matched, unmatched
  FROM public.orders o
  JOIN public.trainee_plans tp ON tp.order_id = o.id
  WHERE o.payment_method = 'arbox' AND o.provider_transaction_id LIKE 'arbox:%';
  RAISE NOTICE 'arbox_purchased_on backfill: % matched, % unmatched', matched, unmatched;
END $$;

UPDATE public.orders o
SET arbox_purchased_on = substring(tp.note from ' (\d{4}-\d{2}-\d{2}) \(\d+\)$')::date
FROM public.trainee_plans tp
WHERE tp.order_id = o.id
  AND o.payment_method = 'arbox'
  AND o.provider_transaction_id LIKE 'arbox:%'
  AND tp.note ~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$';
