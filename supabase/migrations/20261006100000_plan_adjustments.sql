-- Adjustment: a Card's balance set by staff, with an audit trail (issue #97, PRD #86).
--
-- Expand only. Apply this BEFORE deploying the code, which calls
-- adjust_plan_sessions and writes plan_adjustments; the code running today
-- never does, so it keeps working after this lands.

-- Every Adjustment (a Card's sessions) and every end-date change, with before,
-- after, why and who. Written only by server actions and adjust_plan_sessions.
CREATE TABLE IF NOT EXISTS public.plan_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.trainee_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['sessions'::text, 'end_date'::text])),
  sessions_before integer,
  sessions_after integer,
  -- Used sessions when the change was made: the balance staff saw was total minus this.
  sessions_used integer,
  ends_before date,
  ends_after date,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 300),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_adjustments_shape CHECK (
    (kind = 'sessions' AND sessions_before IS NOT NULL AND sessions_after IS NOT NULL AND sessions_used IS NOT NULL)
    OR (kind = 'end_date' AND ends_after IS NOT NULL)
  )
);

COMMENT ON TABLE public.plan_adjustments IS
  'Audit trail of Adjustments to a Card''s sessions and of end-date changes. Written only by server actions and adjust_plan_sessions().';

CREATE INDEX IF NOT EXISTS plan_adjustments_plan_id_idx ON public.plan_adjustments (plan_id);
CREATE INDEX IF NOT EXISTS plan_adjustments_created_by_idx ON public.plan_adjustments (created_by);

ALTER TABLE public.plan_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_adjustments_select_admin ON public.plan_adjustments;
CREATE POLICY plan_adjustments_select_admin ON public.plan_adjustments AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin'::user_role);

REVOKE ALL ON public.plan_adjustments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plan_adjustments FROM authenticated;

-- Applies an Adjustment under the same per-trainee lock book_slot_checked
-- takes, so a booking and an Adjustment never interleave. It refuses when the
-- Card changed since staff read it or is no longer live, clears the reminder stamps only when the
-- Card gains sessions, and writes the audit row in the same transaction.
CREATE OR REPLACE FUNCTION public.adjust_plan_sessions(
  p_plan_id uuid,
  p_expected_total integer,
  p_new_total integer,
  p_used integer,
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_total integer;
  v_status text;
  v_ended_on date;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT sessions_total, status::text, ended_on INTO v_total, v_status, v_ended_on
    FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  -- A Void, Cancellation or Early end may have landed since the action read the Plan.
  IF v_status <> 'active' OR v_ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  IF v_total IS DISTINCT FROM p_expected_total THEN RAISE EXCEPTION 'balance_changed'; END IF;
  IF p_new_total IS NULL OR p_new_total < 1 THEN RAISE EXCEPTION 'invalid_total'; END IF;

  UPDATE trainee_plans
    SET sessions_total = p_new_total,
        reminded_last_session_at = CASE WHEN p_new_total > v_total THEN NULL ELSE reminded_last_session_at END,
        reminded_expired_at = CASE WHEN p_new_total > v_total THEN NULL ELSE reminded_expired_at END
    WHERE id = p_plan_id;

  INSERT INTO plan_adjustments (plan_id, kind, sessions_before, sessions_after, sessions_used, reason, created_by)
    VALUES (p_plan_id, 'sessions', v_total, p_new_total, p_used, p_reason, p_actor);
END $function$;

REVOKE ALL ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_sessions(uuid, integer, integer, integer, text, uuid) TO service_role;

-- A new end date, atomically with its audit row, under the same per-trainee
-- lock. The app computes the terms (a duration, or an Arbox fixed end); the
-- function refuses when the Plan is no longer live or its end changed since
-- staff read it, and gives the new end fresh reminder stamps.
CREATE OR REPLACE FUNCTION public.adjust_plan_end_date(
  p_plan_id uuid,
  p_expected_ends_on date,
  p_duration_days integer,
  p_fixed_ends_on date,
  p_ends_on date,
  p_ends_before date,
  p_reason text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainee uuid;
  v_status text;
  v_ended_on date;
  v_ends_on date;
BEGIN
  SELECT profile_id INTO v_trainee FROM trainee_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_trainee::text));

  SELECT status::text, ended_on, ends_on INTO v_status, v_ended_on, v_ends_on
    FROM trainee_plans WHERE id = p_plan_id FOR UPDATE;
  IF v_status <> 'active' OR v_ended_on IS NOT NULL THEN RAISE EXCEPTION 'plan_not_live'; END IF;
  IF v_ends_on IS DISTINCT FROM p_expected_ends_on THEN RAISE EXCEPTION 'plan_changed'; END IF;
  IF (p_duration_days IS NULL) = (p_fixed_ends_on IS NULL) THEN RAISE EXCEPTION 'invalid_terms'; END IF;

  UPDATE trainee_plans
    SET duration_days = COALESCE(p_duration_days, duration_days),
        fixed_ends_on = COALESCE(p_fixed_ends_on, fixed_ends_on),
        not_before = COALESCE(not_before, starts_on),
        ends_on = p_ends_on,
        reminded_3_days_at = NULL,
        reminded_last_session_at = NULL,
        reminded_expired_at = NULL
    WHERE id = p_plan_id;

  INSERT INTO plan_adjustments (plan_id, kind, ends_before, ends_after, reason, created_by)
    VALUES (p_plan_id, 'end_date', p_ends_before, p_ends_on, p_reason, p_actor);
END $function$;

REVOKE ALL ON FUNCTION public.adjust_plan_end_date(uuid, date, integer, date, date, date, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_plan_end_date(uuid, date, integer, date, date, date, text, uuid) TO service_role;
