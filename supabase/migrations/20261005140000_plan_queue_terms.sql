-- The Plan queue (ADR-0008, issue #87).
--
-- A Plan's dates are derived by the queue resolver (src/lib/plans/plan-queue.ts)
-- from its sale-time terms; starts_on and ends_on stay as a cached forecast.
-- Expand step. Apply this BEFORE deploying the code: the new code writes the
-- new columns and books through book_slot_checked. The columns are nullable
-- and the old book_slot stays, so the code running today keeps working after
-- this lands; a Plan without terms takes its stored window as its terms.

ALTER TABLE public.trainee_plans
  ADD COLUMN IF NOT EXISTS not_before date,
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS fixed_ends_on date;

ALTER TABLE public.trainee_plans
  DROP CONSTRAINT IF EXISTS trainee_plans_duration_days_check,
  ADD CONSTRAINT trainee_plans_duration_days_check CHECK (duration_days IS NULL OR duration_days > 0);

COMMENT ON COLUMN public.trainee_plans.not_before IS
  'Sale-time term: the earliest day the Plan may start. The queue starts it later when a Plan ahead is still running.';
COMMENT ON COLUMN public.trainee_plans.duration_days IS
  'Sale-time term: days the Plan runs once it starts.';
COMMENT ON COLUMN public.trainee_plans.fixed_ends_on IS
  'Sale-time term: the end date of an Arbox purchase, which never moves.';
COMMENT ON COLUMN public.trainee_plans.starts_on IS
  'Cached forecast of the start the Plan queue gives the Plan. The queue resolver is the authority.';
COMMENT ON COLUMN public.trainee_plans.ends_on IS
  'Cached forecast of the end the Plan queue gives the Plan. The queue resolver is the authority.';

-- Backfill. Every Plan keeps the length it was sold with. A Plan placed
-- straight after one bought before it (a chained renewal, or an Arbox
-- purchase moved behind a live one) was waiting in line, so it may start from
-- the day it was bought, even when the one ahead was later cancelled; any
-- other Plan keeps its stored start. Arbox purchases keep their
-- end date. Only rows not yet backfilled are touched, so a rerun is a no-op.
UPDATE public.trainee_plans tp
SET
  duration_days = tp.ends_on - tp.starts_on + 1,
  not_before = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.trainee_plans ahead
      JOIN public.plan_products ap ON ap.id = ahead.product_id
      WHERE ahead.profile_id = tp.profile_id
        AND ahead.id <> tp.id
        AND ap.kind <> 'addon'
        AND ahead.created_at < tp.created_at
        AND ahead.ends_on = tp.starts_on - 1
    )
    THEN LEAST(tp.starts_on, (tp.created_at AT TIME ZONE 'Asia/Jerusalem')::date)
    ELSE tp.starts_on
  END,
  fixed_ends_on = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = tp.order_id AND o.payment_method = 'arbox'
    )
    THEN tp.ends_on
    ELSE NULL
  END
WHERE tp.not_before IS NULL;

-- Booking under the queue. The app decides whether the Booking fits the Plan
-- queue, from the roster rows it read. This function takes the same
-- per-trainee lock as before and refuses when those rows are no longer the
-- trainee's counted rows (active, or cancelled late), so parallel requests
-- cannot all pass on the same picture. Capacity is checked under the slot lock.
CREATE OR REPLACE FUNCTION public.book_slot_checked(
  p_slot_id uuid,
  p_trainee_id uuid,
  p_trainee_name text,
  p_counted_row_ids uuid[]
)
RETURNS TABLE(roster_id uuid, seats_taken integer, max_trainees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max INTEGER;
  v_taken INTEGER;
  v_id UUID;
  v_active BOOLEAN;
  v_next INTEGER;
  v_expected UUID[] := COALESCE(p_counted_row_ids, '{}');
  v_counted UUID[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_trainee_id::text));

  SELECT s.max_trainees INTO v_max
    FROM daily_schedule_slots s WHERE s.id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_not_found'; END IF;
  IF v_max IS NULL THEN RAISE EXCEPTION 'slot_not_bookable'; END IF;

  SELECT t.id, (t.cancelled_at IS NULL) INTO v_id, v_active
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.trainee_id = p_trainee_id;
  IF v_id IS NOT NULL AND v_active THEN RAISE EXCEPTION 'already_booked'; END IF;

  SELECT COALESCE(array_agg(t.id ORDER BY t.id), '{}') INTO v_counted
    FROM daily_schedule_slot_trainees t
    JOIN daily_schedule_slots s ON s.id = t.slot_id
    WHERE t.trainee_id = p_trainee_id
      AND (t.cancelled_at IS NULL OR t.late_cancel);
  IF v_counted IS DISTINCT FROM
     (SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(v_expected) AS x)
  THEN
    RAISE EXCEPTION 'roster_changed';
  END IF;

  SELECT count(*)::int INTO v_taken
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.cancelled_at IS NULL;
  IF v_taken >= v_max THEN RAISE EXCEPTION 'capacity_full'; END IF;

  IF v_id IS NOT NULL THEN
    UPDATE daily_schedule_slot_trainees
      SET cancelled_at = NULL, late_cancel = false, booked_at = now(), source = 'self', reminded_at = NULL
      WHERE id = v_id;
  ELSE
    SELECT COALESCE(max(t.order_index), -1) + 1 INTO v_next
      FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id;
    INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source, booked_at)
      VALUES (p_slot_id, p_trainee_id, p_trainee_name, v_next, 'self', now())
      RETURNING id INTO v_id;
  END IF;

  -- A trainee who books after the group workout was written still gets it,
  -- in this transaction. No-ops when the slot has no group workout.
  PERFORM apply_slot_workout_to_trainee(p_slot_id, p_trainee_id);

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $function$;

REVOKE ALL ON FUNCTION public.book_slot_checked(uuid, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot_checked(uuid, uuid, text, uuid[]) TO service_role;

-- book_slot (the window-and-count version) stays until this release is live,
-- so a page served before the deploy can still book; a later migration drops it.
