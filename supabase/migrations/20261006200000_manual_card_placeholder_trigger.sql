-- A branch that starts selling gets its manual Card placeholder (follow-up to
-- 20261006180000_manual_cards). That migration seeded the branches selling at
-- the time; this keeps the same rule for every branch after it: the first
-- active catalog product of a branch creates its "כרטיסייה ידנית".
--
-- Expand only; no code change depends on it.

-- The one definition of a branch's placeholder; a later backfill calls it too.
CREATE OR REPLACE FUNCTION public.seed_manual_card_placeholder(p_branch_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO plan_products (branch_id, slug, name_he, kind, price_ils, sessions_total, duration_days, is_active, staff_terms, order_index)
  SELECT p_branch_id,
         'manual_card_' || left(replace(p_branch_id::text, '-', ''), 12),
         'כרטיסייה ידנית', 'session_card', 1, 1, 30, false, true, 999
   WHERE NOT EXISTS (SELECT 1 FROM plan_products p WHERE p.branch_id = p_branch_id AND p.staff_terms)
  ON CONFLICT (slug) DO NOTHING;
$function$;

REVOKE ALL ON FUNCTION public.seed_manual_card_placeholder(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_manual_card_placeholder(uuid) TO service_role;

-- The trigger's WHEN clause picks active catalog rows; this only seeds.
CREATE OR REPLACE FUNCTION public.ensure_manual_card_placeholder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM seed_manual_card_placeholder(NEW.branch_id);
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.ensure_manual_card_placeholder() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS plan_products_manual_card_placeholder ON public.plan_products;
-- branch_id too: an active product moved to a branch makes it a selling branch.
CREATE TRIGGER plan_products_manual_card_placeholder
  AFTER INSERT OR UPDATE OF is_active, branch_id ON public.plan_products
  FOR EACH ROW
  WHEN (NEW.is_active AND NOT NEW.staff_terms)
  EXECUTE FUNCTION public.ensure_manual_card_placeholder();
