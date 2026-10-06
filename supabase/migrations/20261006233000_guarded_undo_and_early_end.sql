-- Void, Cancellation and Early end write under the per-trainee booking lock
-- and refuse a stale read, like Booking, Adjustment and Freeze already do.
--
-- Each act reads the roster and the Plans, works out which Bookings the shrink
-- rule moves or cancels, then writes. A Booking that landed in between was not
-- in that reading, so it escaped the shrink rule and stayed on a Plan that no
-- longer covers it. Now the write takes the lock and runs
-- assert_trainee_unchanged on what the act read; a Booking made after the
-- write sees the new Plan stamps and is refused by book_slot_checked.
--
-- The Plan, its refund record and its order (undo_plan), or the Plan and its
-- required activity record (end_plan_early), are written in one transaction,
-- replacing the app's claim-then-compensate sequence.
--
-- Expand only: no deployed code calls these yet.

-- The per-trainee lock and the Plan row, then the guard. No liveness rule:
-- an undo act's own refusals decide which Plans it may touch.
CREATE OR REPLACE FUNCTION public.lock_trainee_plan(
  p_plan_id uuid,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS trainee_plans
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_plan trainee_plans;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT * INTO v_plan FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  PERFORM assert_trainee_unchanged(v_trainee, p_counted_row_ids, p_plan_stamps);
  RETURN v_plan;
END $function$;

REVOKE ALL ON FUNCTION public.lock_trainee_plan(uuid, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_trainee_plan(uuid, uuid[], timestamptz[]) TO service_role;

-- Same contract as before, now built on lock_trainee_plan.
CREATE OR REPLACE FUNCTION public.lock_live_plan(
  p_plan_id uuid,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS trainee_plans
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan trainee_plans;
BEGIN
  v_plan := lock_trainee_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
  -- A Void, Cancellation or Early end may have landed since the action read the Plan.
  IF v_plan.status::text <> 'active' OR v_plan.ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  RETURN v_plan;
END $function$;

-- A Void (p_status voided) or a Cancellation (p_status cancelled, ending on
-- p_ended_on): the Plan, its plan_refunds record, and its order's status when
-- p_order_status is given. Returns the refund record's id.
CREATE FUNCTION public.undo_plan(
  p_plan_id uuid,
  p_status text,
  p_ended_on date,
  p_kind text,
  p_reason text,
  p_amount_ils numeric,
  p_proposed_amount_ils numeric,
  p_override_reason text,
  p_defect boolean,
  p_method text,
  p_reference text,
  p_order_status text,
  p_actor uuid,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan trainee_plans;
  v_refund uuid;
BEGIN
  IF NOT ((p_status = 'voided' AND p_kind = 'void')
       OR (p_status = 'cancelled' AND p_kind = 'cancellation' AND p_ended_on IS NOT NULL)) THEN
    RAISE EXCEPTION 'invalid_undo';
  END IF;
  v_plan := lock_trainee_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
  IF v_plan.status::text = p_status THEN RAISE EXCEPTION 'plan_not_live'; END IF;

  UPDATE trainee_plans
    SET status = p_status,
        ended_on = CASE WHEN p_status = 'voided' THEN NULL ELSE p_ended_on END
    WHERE id = p_plan_id;

  INSERT INTO plan_refunds (plan_id, order_id, kind, reason, amount_ils, proposed_amount_ils,
                            override_reason, defect, method, reference, created_by)
    VALUES (p_plan_id, v_plan.order_id, p_kind, p_reason, p_amount_ils, p_proposed_amount_ils,
            p_override_reason, COALESCE(p_defect, false), p_method, p_reference, p_actor)
    RETURNING id INTO v_refund;

  -- A Plan undone on an order still marked paid would count as revenue.
  IF p_order_status IS NOT NULL AND v_plan.order_id IS NOT NULL THEN
    UPDATE orders SET status = p_order_status WHERE id = v_plan.order_id;
  END IF;
  RETURN v_refund;
END $function$;

REVOKE ALL ON FUNCTION public.undo_plan(uuid, text, date, text, text, numeric, numeric, text, boolean, text, text, text, uuid, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_plan(uuid, text, date, text, text, numeric, numeric, text, boolean, text, text, text, uuid, uuid[], timestamptz[]) TO service_role;

-- An Early end: the Current plan ends on p_ended_on and its reason is
-- recorded. Without the record there is no Early end.
CREATE FUNCTION public.end_plan_early(
  p_plan_id uuid,
  p_ended_on date,
  p_actor uuid,
  p_actor_name text,
  p_metadata jsonb,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan trainee_plans;
BEGIN
  v_plan := lock_live_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
  UPDATE trainee_plans SET ended_on = p_ended_on WHERE id = p_plan_id;
  INSERT INTO activity_logs (user_id, action, actor_id, actor_name, metadata)
    VALUES (v_plan.profile_id, 'plan_ended_early', p_actor, p_actor_name, p_metadata);
END $function$;

REVOKE ALL ON FUNCTION public.end_plan_early(uuid, date, uuid, text, jsonb, uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_plan_early(uuid, date, uuid, text, jsonb, uuid[], timestamptz[]) TO service_role;
