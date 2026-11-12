-- ===========================================
-- Haifa sells on the site too.
--
-- The Haifa landing page's price cards now come from plan_products, as the
-- קריית אתא page's do, and every "הצטרפו" leads to /join?branch=haifa. These
-- are the five plans of the Haifa branch poster at its prices, active at once
-- (owner, 2026-11-09). What the poster leaves open takes the קריית אתא values:
-- 30 days for a monthly plan and the intro, 98 days (14 weeks) for the
-- 10-session card. Admins change any of it in /admin/plans/products.
--
-- The first active product fires plan_products_manual_card_placeholder,
-- which seeds Haifa's "כרטיסייה ידנית".
--
-- Safe in either order with the code: until it runs, the Haifa page shows
-- its poster with WhatsApp buttons; the code before this change never shows
-- Haifa products to parents.
-- ===========================================

SET LOCAL lock_timeout = '3s';

DO $$
DECLARE
  v_branch UUID;
BEGIN
  SELECT id INTO v_branch FROM branches WHERE name_he = 'חיפה';
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'branch חיפה is missing; apply 20260910120000_branches.sql first';
  END IF;

  INSERT INTO plan_products
    (branch_id, slug, name_he, blurb_he, kind, price_ils, sessions_total, duration_days, once_per_trainee, max_installments, order_index)
  VALUES
    (v_branch, 'haifa_twice_weekly', '2 אימונים בשבוע', 'מנוי חודשי', 'subscription', 1450, NULL, 30, false, 3, 0),
    (v_branch, 'haifa_once_weekly', 'אימון אחד בשבוע', 'מנוי חודשי', 'subscription', 850, NULL, 30, false, 3, 1),
    (v_branch, 'haifa_intro', 'מסלול היכרות', '2 אימונים, להכיר את השיטה לפני שמצטרפים', 'session_card', 200, 2, 30, true, 1, 2),
    (v_branch, 'haifa_unlimited', 'ללא הגבלה', 'מנוי חודשי', 'subscription', 1650, NULL, 30, false, 3, 3),
    (v_branch, 'haifa_card_10', 'כרטיסיית 10 אימונים', 'מנצלים בקצב שלכם. ₪210 לאימון', 'session_card', 2100, 10, 98, false, 3, 4)
  ON CONFLICT (slug) DO NOTHING;
END $$;
