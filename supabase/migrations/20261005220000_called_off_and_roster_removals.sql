-- Called off Slots and recorded Roster removals (issue #96, PRD #86).
--
-- Expand only, plus book_slot_checked redefined. Apply this BEFORE deploying
-- the code: the new code reads these columns and passes a counted set that
-- skips Called off Slots, which the function must match. The code running
-- today never sets them, so it keeps working after this lands.

-- A Slot the academy called off after the fact (weather, no pitch, no
-- Trainer). Its Roster stays on record; nobody on it uses a session.
ALTER TABLE public.daily_schedule_slots
  ADD COLUMN IF NOT EXISTS called_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS called_off_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- A snapshot, like trainer_name: the board stays readable without a profile read.
  ADD COLUMN IF NOT EXISTS called_off_by_name text CHECK (called_off_by_name IS NULL OR char_length(called_off_by_name) <= 100),
  ADD COLUMN IF NOT EXISTS called_off_reason text;

ALTER TABLE public.daily_schedule_slots
  DROP CONSTRAINT IF EXISTS daily_schedule_slots_called_off_check,
  ADD CONSTRAINT daily_schedule_slots_called_off_check CHECK (
    (called_off_at IS NULL AND called_off_reason IS NULL)
    OR (called_off_at IS NOT NULL AND char_length(called_off_reason) BETWEEN 2 AND 300)
  );

CREATE INDEX IF NOT EXISTS daily_schedule_slots_called_off_by_idx ON public.daily_schedule_slots (called_off_by);

COMMENT ON COLUMN public.daily_schedule_slots.called_off_at IS
  'The academy called the Slot off after it was due; its Roster stays and nobody on it uses a session.';

-- Removing a name from a Slot that already started is recorded, not deleted:
-- the row is cancelled (not late, so it costs nothing) and keeps who and why.
ALTER TABLE public.daily_schedule_slot_trainees
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_by_name text CHECK (removed_by_name IS NULL OR char_length(removed_by_name) <= 100),
  ADD COLUMN IF NOT EXISTS removed_reason text;

ALTER TABLE public.daily_schedule_slot_trainees
  DROP CONSTRAINT IF EXISTS daily_schedule_slot_trainees_removed_check,
  ADD CONSTRAINT daily_schedule_slot_trainees_removed_check CHECK (
    (removed_at IS NULL AND removed_reason IS NULL)
    OR (
      removed_at IS NOT NULL
      AND cancelled_at IS NOT NULL
      AND late_cancel = false
      AND char_length(removed_reason) BETWEEN 2 AND 300
    )
  );

CREATE INDEX IF NOT EXISTS daily_schedule_slot_trainees_removed_by_idx ON public.daily_schedule_slot_trainees (removed_by);

-- Staff RLS lets any active trainer write these tables, but Called off and a
-- recorded removal move sessions on Cards and carry an audit trail: they are
-- set only by the server actions (service role) after their own checks
-- (Admin or Branch manager for Called off; the Slot's Trainers or a manager
-- for a removal). A request signed by a user cannot set or change them.
-- Migrations and SQL run without a user and pass.
CREATE OR REPLACE FUNCTION public.guard_slot_called_off()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.called_off_at IS NOT NULL OR NEW.called_off_by IS NOT NULL
       OR NEW.called_off_by_name IS NOT NULL OR NEW.called_off_reason IS NOT NULL THEN
      RAISE EXCEPTION 'called_off is set by the server only' USING ERRCODE = '42501';
    END IF;
  ELSIF (NEW.called_off_at, NEW.called_off_by, NEW.called_off_by_name, NEW.called_off_reason)
        IS DISTINCT FROM (OLD.called_off_at, OLD.called_off_by, OLD.called_off_by_name, OLD.called_off_reason) THEN
    RAISE EXCEPTION 'called_off is set by the server only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS daily_schedule_slots_guard_called_off ON public.daily_schedule_slots;
CREATE TRIGGER daily_schedule_slots_guard_called_off
  BEFORE INSERT OR UPDATE ON public.daily_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.guard_slot_called_off();

CREATE OR REPLACE FUNCTION public.guard_roster_removal()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.removed_at IS NOT NULL OR NEW.removed_by IS NOT NULL
       OR NEW.removed_by_name IS NOT NULL OR NEW.removed_reason IS NOT NULL THEN
      RAISE EXCEPTION 'a roster removal is recorded by the server only' USING ERRCODE = '42501';
    END IF;
  ELSIF (NEW.removed_at, NEW.removed_by, NEW.removed_by_name, NEW.removed_reason)
        IS DISTINCT FROM (OLD.removed_at, OLD.removed_by, OLD.removed_by_name, OLD.removed_reason) THEN
    RAISE EXCEPTION 'a roster removal is recorded by the server only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS daily_schedule_slot_trainees_guard_removal ON public.daily_schedule_slot_trainees;
CREATE TRIGGER daily_schedule_slot_trainees_guard_removal
  BEFORE INSERT OR UPDATE ON public.daily_schedule_slot_trainees
  FOR EACH ROW EXECUTE FUNCTION public.guard_roster_removal();

REVOKE ALL ON FUNCTION public.guard_slot_called_off() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_roster_removal() FROM PUBLIC, anon, authenticated;

-- The booking guard counts what the app counts: rows on a Called off Slot
-- are no longer the trainee's counted rows.
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
      AND (t.cancelled_at IS NULL OR t.late_cancel)
      -- A Called off Slot uses nobody's session (rowCounts in booking-rules.ts).
      AND s.called_off_at IS NULL;
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
