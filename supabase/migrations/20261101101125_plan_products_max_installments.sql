-- Issue #161: the most card installments a product may be paid in.
--
-- Expand only, safe to apply BEFORE the code deploys: the code running today
-- never reads the column. The default keeps every product at today's limit
-- (3, MAX_INSTALLMENTS in src/lib/validations/card-payment.ts); the client's
-- rule then lowers the two smaller cards. A manual Card ("כרטיסייה ידנית",
-- staff_terms) ignores the column: its cap follows the sessions on its order
-- (src/lib/plans/installments.ts).

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.plan_products
  ADD COLUMN IF NOT EXISTS max_installments SMALLINT NOT NULL DEFAULT 3
    CHECK (max_installments BETWEEN 1 AND 3);

COMMENT ON COLUMN public.plan_products.max_installments IS
  'Most card installments allowed (1-3). Ignored for staff_terms products, whose cap follows the order''s sessions.';

UPDATE public.plan_products SET max_installments = 1 WHERE slug = 'intro_pack';
UPDATE public.plan_products SET max_installments = 2 WHERE slug = 'card_10';
UPDATE public.plan_products SET max_installments = 3 WHERE slug = 'card_20';
