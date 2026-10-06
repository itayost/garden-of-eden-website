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
-- Each act, whole or not at all, is one transaction: the Plan, its refund
-- record and order (undo_plan), the shrink rule's cancellations, and the
-- activity record. This replaces the app's claim-then-compensate sequence and
-- the cancellations it ran after the claim, outside the lock.
--
-- Expand only: no deployed code calls these yet.

-- The per-trainee lock and the Plan row. No liveness rule and no guard: each
-- caller checks its own liveness rule first, then assert_trainee_unchanged, so
-- a Plan that is no longer live is reported as such rather than as a stale read.
CREATE OR REPLACE FUNCTION public.lock_trainee_plan(p_plan_id uuid)
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
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  RETURN v_plan;
END $function$;

REVOKE ALL ON FUNCTION public.lock_trainee_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_trainee_plan(uuid) TO service_role;

-- Same contract as before (liveness, then the guard), now built on lock_trainee_plan.
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
  v_plan := lock_trainee_plan(p_plan_id);
  -- A Void, Cancellation or Early end may have landed since the action read the Plan.
  IF v_plan.status::text <> 'active' OR v_plan.ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  PERFORM assert_trainee_unchanged(v_plan.profile_id, p_counted_row_ids, p_plan_stamps);
  RETURN v_plan;
END $function$;

-- The shrink rule's cancellations, inside the act's transaction: each row is
-- cancelled as a normal, not late, cancellation (it frees the seat and costs
-- no session), the slot's group workout leaves with it, and the Trainee gets
-- the notice at the same position in p_notices. The caller holds the
-- per-trainee lock and has run the guard, so every row is still booked; one
-- that is not means the roster moved, and the whole act is refused.
CREATE FUNCTION public.cancel_shrunk_bookings(
  p_trainee_id uuid,
  p_row_ids uuid[],
  p_notices text[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_wanted integer := COALESCE(array_length(p_row_ids, 1), 0);
  v_row record;
  v_done integer := 0;
BEGIN
  IF v_wanted <> COALESCE(array_length(p_notices, 1), 0) THEN RAISE EXCEPTION 'invalid_cancellations'; END IF;
  IF v_wanted = 0 THEN RETURN 0; END IF;

  FOR v_row IN
    UPDATE daily_schedule_slot_trainees
       SET cancelled_at = now(), late_cancel = false
     WHERE id = ANY(p_row_ids) AND trainee_id = p_trainee_id AND cancelled_at IS NULL
     RETURNING slot_id
  LOOP
    PERFORM drop_slot_workout_session(v_row.slot_id, p_trainee_id);
    v_done := v_done + 1;
  END LOOP;
  IF v_done <> v_wanted THEN RAISE EXCEPTION 'roster_changed'; END IF;

  INSERT INTO trainee_notices (profile_id, body_he) SELECT p_trainee_id, n FROM unnest(p_notices) AS n;
  RETURN v_done;
END $function$;

REVOKE ALL ON FUNCTION public.cancel_shrunk_bookings(uuid, uuid[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_shrunk_bookings(uuid, uuid[], text[]) TO service_role;

-- A Void (p_status voided) or a Cancellation (p_status cancelled, ending on
-- p_ended_on), whole or not at all: the Plan, its plan_refunds record, its
-- order's status when p_order_status is given, the shrink rule's
-- cancellations, and the activity record (p_log_metadata plus the refund id).
-- Returns the refund record's id.
CREATE FUNCTION public.undo_plan(
  p_plan_id uuid,
  p_status text,
  p_ended_on date,
  p_reason text,
  p_amount_ils numeric,
  p_proposed_amount_ils numeric,
  p_override_reason text,
  p_defect boolean,
  p_method text,
  p_reference text,
  p_order_status text,
  p_actor uuid,
  p_actor_name text,
  p_log_metadata jsonb,
  p_cancel_row_ids uuid[],
  p_cancel_notices text[],
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
  v_kind text;
  v_refund uuid;
BEGIN
  v_kind := CASE
    WHEN p_status = 'voided' THEN 'void'
    WHEN p_status = 'cancelled' AND p_ended_on IS NOT NULL THEN 'cancellation'
  END;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'invalid_undo'; END IF;

  v_plan := lock_trainee_plan(p_plan_id);
  -- The rules of voidRefusal and the Cancellation's assess(): nothing voided or
  -- already ended; a Cancellation only of an active Plan (a Void may still
  -- undo an older cancellation that never set ended_on).
  IF v_plan.status::text = 'voided'
     OR v_plan.ended_on IS NOT NULL
     OR (p_status = 'cancelled' AND v_plan.status::text <> 'active') THEN
    RAISE EXCEPTION 'plan_not_live';
  END IF;
  PERFORM assert_trainee_unchanged(v_plan.profile_id, p_counted_row_ids, p_plan_stamps);

  UPDATE trainee_plans
    SET status = p_status,
        ended_on = CASE WHEN p_status = 'voided' THEN NULL ELSE p_ended_on END
    WHERE id = p_plan_id;

  INSERT INTO plan_refunds (plan_id, order_id, kind, reason, amount_ils, proposed_amount_ils,
                            override_reason, defect, method, reference, created_by)
    VALUES (p_plan_id, v_plan.order_id, v_kind, p_reason, p_amount_ils, p_proposed_amount_ils,
            p_override_reason, COALESCE(p_defect, false), p_method, p_reference, p_actor)
    RETURNING id INTO v_refund;

  -- A Plan undone on an order still marked paid would count as revenue.
  IF p_order_status IS NOT NULL AND v_plan.order_id IS NOT NULL THEN
    UPDATE orders SET status = p_order_status WHERE id = v_plan.order_id;
  END IF;

  PERFORM cancel_shrunk_bookings(v_plan.profile_id, p_cancel_row_ids, p_cancel_notices);

  INSERT INTO activity_logs (user_id, action, actor_id, actor_name, metadata)
    VALUES (v_plan.profile_id,
            CASE v_kind WHEN 'void' THEN 'plan_voided' ELSE 'plan_cancelled' END,
            p_actor, p_actor_name,
            COALESCE(p_log_metadata, '{}'::jsonb) || jsonb_build_object('refundId', v_refund));
  RETURN v_refund;
END $function$;

REVOKE ALL ON FUNCTION public.undo_plan(uuid, text, date, text, numeric, numeric, text, boolean, text, text, text, uuid, text, jsonb, uuid[], text[], uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_plan(uuid, text, date, text, numeric, numeric, text, boolean, text, text, text, uuid, text, jsonb, uuid[], text[], uuid[], timestamptz[]) TO service_role;

-- An Early end, whole or not at all: the Current plan ends on p_ended_on, the
-- shrink rule's cancellations, and the activity record with the reason.
CREATE FUNCTION public.end_plan_early(
  p_plan_id uuid,
  p_ended_on date,
  p_actor uuid,
  p_actor_name text,
  p_log_metadata jsonb,
  p_cancel_row_ids uuid[],
  p_cancel_notices text[],
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
  PERFORM cancel_shrunk_bookings(v_plan.profile_id, p_cancel_row_ids, p_cancel_notices);
  INSERT INTO activity_logs (user_id, action, actor_id, actor_name, metadata)
    VALUES (v_plan.profile_id, 'plan_ended_early', p_actor, p_actor_name, p_log_metadata);
END $function$;

REVOKE ALL ON FUNCTION public.end_plan_early(uuid, date, uuid, text, jsonb, uuid[], text[], uuid[], timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_plan_early(uuid, date, uuid, text, jsonb, uuid[], text[], uuid[], timestamptz[]) TO service_role;
