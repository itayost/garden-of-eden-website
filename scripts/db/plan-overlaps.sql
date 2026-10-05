-- Read-only. Training Plans of one Trainee whose stored windows overlap.
-- Under the Plan queue (ADR-0008) the second waits behind the first, so its
-- dates move; list them before the switch so they can be fixed by hand.
-- Run: supabase db query --linked --agent no -f scripts/db/plan-overlaps.sql
SELECT
  pr.full_name AS trainee,
  a.profile_id,
  a.id AS first_plan,
  pa.name_he AS first_product,
  a.starts_on AS first_starts,
  a.ends_on AS first_ends,
  a.sessions_total AS first_sessions,
  oa.payment_method AS first_paid_by,
  b.id AS second_plan,
  pb.name_he AS second_product,
  b.starts_on AS second_starts,
  b.ends_on AS second_ends,
  b.sessions_total AS second_sessions,
  ob.payment_method AS second_paid_by
FROM trainee_plans a
JOIN trainee_plans b
  ON b.profile_id = a.profile_id
 AND (b.created_at, b.id) > (a.created_at, a.id)
 AND daterange(a.starts_on, a.ends_on, '[]') && daterange(b.starts_on, b.ends_on, '[]')
JOIN plan_products pa ON pa.id = a.product_id
JOIN plan_products pb ON pb.id = b.product_id
JOIN profiles pr ON pr.id = a.profile_id
LEFT JOIN orders oa ON oa.id = a.order_id
LEFT JOIN orders ob ON ob.id = b.order_id
WHERE a.status = 'active'
  AND b.status = 'active'
  AND pa.kind <> 'addon'
  AND pb.kind <> 'addon'
ORDER BY pr.full_name, a.starts_on;
