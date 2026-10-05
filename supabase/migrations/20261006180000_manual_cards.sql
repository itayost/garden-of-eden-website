-- Manual Card: an Admin or the branch's manager types the sessions, price and
-- validity of a Card (owner's request, 2026-10-06).
--
-- Expand only. Apply BEFORE deploying the code that sells manual Cards; the
-- code running today never reads these columns, and the new products are
-- inactive, so /join never lists them.

-- A product sold on terms staff type: one "כרטיסייה ידנית" per selling branch.
-- Its price and terms are placeholders; the order carries the real ones.
ALTER TABLE public.plan_products
  ADD COLUMN IF NOT EXISTS staff_terms boolean NOT NULL DEFAULT false;

-- Never on sale by itself: activating it would list a 1 ILS Card on /join.
ALTER TABLE public.plan_products DROP CONSTRAINT IF EXISTS plan_products_staff_terms_inactive;
ALTER TABLE public.plan_products ADD CONSTRAINT plan_products_staff_terms_inactive
  CHECK (NOT staff_terms OR NOT is_active);

INSERT INTO public.plan_products (branch_id, slug, name_he, kind, price_ils, sessions_total, duration_days, is_active, staff_terms, order_index)
SELECT b.branch_id,
       'manual_card_' || left(replace(b.branch_id::text, '-', ''), 12),
       'כרטיסייה ידנית',
       'session_card',
       1,
       1,
       30,
       false,
       true,
       999
  FROM (SELECT DISTINCT branch_id FROM public.plan_products WHERE is_active) b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.plan_products p WHERE p.branch_id = b.branch_id AND p.staff_terms
 );

-- The terms a manual Card was sold on; NULL for a catalog sale.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS terms_sessions_total integer,
  ADD COLUMN IF NOT EXISTS terms_duration_days integer;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_staff_terms_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_staff_terms_check CHECK (
  (terms_sessions_total IS NULL AND terms_duration_days IS NULL)
  OR (terms_sessions_total BETWEEN 1 AND 200 AND terms_duration_days BETWEEN 1 AND 730)
);
