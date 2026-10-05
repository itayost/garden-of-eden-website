-- Freeze: medical stretches when the Current plan does not run (issue #98, PRD #86).
--
-- Expand only; needs lock_live_plan and assert_trainee_unchanged from
-- 20261006110000. Apply BEFORE deploying the code, which reads plan_freezes
-- with every Plan; the code running today never does.
--
-- The queue (resolvePlanQueue) reads the Freezes: the Plan does not run on
-- those days and its end, and the queue behind it, move by them. An
-- open-ended Freeze (ends_on NULL) runs until an Admin or Branch manager ends it.

CREATE TABLE IF NOT EXISTS public.plan_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.trainee_plans(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date,
  -- The medical reason; a Freeze is never for a vacation.
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 300),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid REFERENCES public.profiles(id),
  ended_at timestamptz,
  CONSTRAINT plan_freezes_dates CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

COMMENT ON TABLE public.plan_freezes IS
  'Medical Freezes of a Plan. Written only by freeze_plan() and end_freeze(); the Plan queue reads them.';

CREATE INDEX IF NOT EXISTS plan_freezes_plan_id_idx ON public.plan_freezes (plan_id);
CREATE INDEX IF NOT EXISTS plan_freezes_created_by_idx ON public.plan_freezes (created_by);
CREATE INDEX IF NOT EXISTS plan_freezes_ended_by_idx ON public.plan_freezes (ended_by);
-- One open-ended Freeze per Plan at most.
CREATE UNIQUE INDEX IF NOT EXISTS plan_freezes_one_open ON public.plan_freezes (plan_id) WHERE ends_on IS NULL;

ALTER TABLE public.plan_freezes ENABLE ROW LEVEL SECURITY;

-- The same readers as the Plan itself: its Trainee and Admins.
DROP POLICY IF EXISTS plan_freezes_select_own_or_admin ON public.plan_freezes;
CREATE POLICY plan_freezes_select_own_or_admin ON public.plan_freezes AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    get_user_role((SELECT auth.uid())) = 'admin'::user_role
    OR EXISTS (SELECT 1 FROM trainee_plans p WHERE p.id = plan_id AND p.profile_id = (SELECT auth.uid()))
  );

REVOKE ALL ON public.plan_freezes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plan_freezes FROM authenticated;

-- A Freeze, under the per-trainee lock, refused if the roster or Plans changed
-- since the action read them or if it shares a day with another Freeze. The
-- Plan's cached end moves to the forecast the app computed and its reminder
-- stamps start over; that write also changes the Plan's stamp, so a Booking
-- judged before the Freeze is refused.
CREATE OR REPLACE FUNCTION public.freeze_plan(
  p_plan_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_plan_ends_on date,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[],
  p_reason text,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM lock_live_plan(p_plan_id, p_counted_row_ids, p_plan_stamps);
  IF p_ends_on IS NOT NULL AND p_ends_on < p_starts_on THEN RAISE EXCEPTION 'invalid_dates'; END IF;
  IF EXISTS (
    SELECT 1 FROM plan_freezes f
      WHERE f.plan_id = p_plan_id
        AND f.starts_on <= COALESCE(p_ends_on, 'infinity'::date)
        AND p_starts_on <= COALESCE(f.ends_on, 'infinity'::date)
  ) THEN
    RAISE EXCEPTION 'freeze_overlap';
  END IF;

  INSERT INTO plan_freezes (plan_id, starts_on, ends_on, reason, created_by)
    VALUES (p_plan_id, p_starts_on, p_ends_on, p_reason, p_actor)
    RETURNING id INTO v_id;

  UPDATE trainee_plans
    SET ends_on = p_plan_ends_on,
        reminded_3_days_at = NULL,
        reminded_last_session_at = NULL,
        reminded_expired_at = NULL
    WHERE id = p_plan_id;
  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.freeze_plan(uuid, date, date, date, uuid[], timestamptz[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_plan(uuid, date, date, date, uuid[], timestamptz[], text, uuid) TO service_role;

-- Ends an open-ended Freeze on a day: its length is counted then. Same lock
-- and guard; the Plan's cached end and reminder stamps as in freeze_plan.
CREATE OR REPLACE FUNCTION public.end_freeze(
  p_freeze_id uuid,
  p_ends_on date,
  p_plan_ends_on date,
  p_counted_row_ids uuid[],
  p_plan_stamps timestamptz[],
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_id uuid;
  v_starts_on date;
BEGIN
  SELECT plan_id INTO v_plan_id FROM plan_freezes WHERE id = p_freeze_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'freeze_not_found'; END IF;
  PERFORM lock_live_plan(v_plan_id, p_counted_row_ids, p_plan_stamps);

  SELECT starts_on INTO v_starts_on FROM plan_freezes WHERE id = p_freeze_id AND ends_on IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'freeze_not_open'; END IF;
  IF p_ends_on < v_starts_on THEN RAISE EXCEPTION 'invalid_dates'; END IF;

  UPDATE plan_freezes SET ends_on = p_ends_on, ended_by = p_actor, ended_at = now() WHERE id = p_freeze_id;
  UPDATE trainee_plans
    SET ends_on = p_plan_ends_on,
        reminded_3_days_at = NULL,
        reminded_last_session_at = NULL,
        reminded_expired_at = NULL
    WHERE id = v_plan_id;
END $function$;

REVOKE ALL ON FUNCTION public.end_freeze(uuid, date, date, uuid[], timestamptz[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_freeze(uuid, date, date, uuid[], timestamptz[], uuid) TO service_role;
