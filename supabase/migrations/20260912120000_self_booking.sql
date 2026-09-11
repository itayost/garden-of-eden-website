-- Self-booking for bookable branches (ADR-0007). Bands gain a seat count and
-- a bookable flag; slots remember which band projected them and how many
-- seats they have; roster rows remember who booked, when, and whether they
-- cancelled late. Staff RLS on the slot tables is unchanged: trainees reach
-- rosters only through server actions that use the service role.

ALTER TABLE public.weekly_schedule_bands
  ADD COLUMN IF NOT EXISTS max_trainees SMALLINT NOT NULL DEFAULT 8
    CHECK (max_trainees BETWEEN 1 AND 40),
  ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.daily_schedule_slots
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.weekly_schedule_bands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_trainees SMALLINT
    CHECK (max_trainees IS NULL OR max_trainees BETWEEN 1 AND 40);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_band_date
  ON public.daily_schedule_slots (band_id, schedule_date) WHERE band_id IS NOT NULL;

ALTER TABLE public.daily_schedule_slot_trainees
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'self')),
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_cancel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_schedule_slot_trainees_trainee_active
  ON public.daily_schedule_slot_trainees (trainee_id, slot_id)
  WHERE trainee_id IS NOT NULL AND cancelled_at IS NULL;

-- A slot staff deleted must not be projected again the next morning.
CREATE TABLE IF NOT EXISTS public.daily_schedule_slot_tombstones (
  band_id UUID NOT NULL REFERENCES public.weekly_schedule_bands(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (band_id, schedule_date)
);
ALTER TABLE public.daily_schedule_slot_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot_tombstones_staff_select" ON public.daily_schedule_slot_tombstones;
CREATE POLICY "slot_tombstones_staff_select" ON public.daily_schedule_slot_tombstones
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'trainer'));
DROP POLICY IF EXISTS "slot_tombstones_staff_insert" ON public.daily_schedule_slot_tombstones;
CREATE POLICY "slot_tombstones_staff_insert" ON public.daily_schedule_slot_tombstones
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'trainer'));

-- One seat, one transaction. Locks the slot row so two parents tapping the
-- last seat together cannot both win; reuses a cancelled row so the partial
-- unique index on (slot_id, trainee_id) never blocks a re-book.
CREATE OR REPLACE FUNCTION public.book_slot(p_slot_id UUID, p_trainee_id UUID, p_trainee_name TEXT)
RETURNS TABLE (roster_id UUID, seats_taken INTEGER, max_trainees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max INTEGER;
  v_taken INTEGER;
  v_id UUID;
  v_active BOOLEAN;
  v_next INTEGER;
BEGIN
  SELECT s.max_trainees INTO v_max FROM daily_schedule_slots s WHERE s.id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_not_found'; END IF;
  IF v_max IS NULL THEN RAISE EXCEPTION 'slot_not_bookable'; END IF;

  SELECT count(*)::int INTO v_taken
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.cancelled_at IS NULL;

  SELECT t.id, (t.cancelled_at IS NULL) INTO v_id, v_active
    FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id AND t.trainee_id = p_trainee_id;

  IF v_id IS NOT NULL AND v_active THEN RAISE EXCEPTION 'already_booked'; END IF;
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

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $$;
REVOKE ALL ON FUNCTION public.book_slot(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- The roster replace used by the staff form keeps booking metadata for
-- linked rows it retains: delete only rows that left the list, update the
-- rest in place, insert the new ones.
CREATE OR REPLACE FUNCTION public.replace_slot_roster(p_slot_id UUID, p_trainees JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM daily_schedule_slot_trainees t
    WHERE t.slot_id = p_slot_id
      AND (t.trainee_id IS NULL
           OR t.trainee_id NOT IN (
             SELECT NULLIF(elem->>'trainee_id', '')::uuid FROM jsonb_array_elements(p_trainees) AS elem
             WHERE NULLIF(elem->>'trainee_id', '') IS NOT NULL));

  UPDATE daily_schedule_slot_trainees t
    SET trainee_name = elem->>'trainee_name',
        order_index = (elem->>'order_index')::int,
        cancelled_at = NULL,
        late_cancel = false
    FROM jsonb_array_elements(p_trainees) AS elem
    WHERE t.slot_id = p_slot_id
      AND t.trainee_id = NULLIF(elem->>'trainee_id', '')::uuid;

  INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index)
  SELECT p_slot_id,
         NULLIF(elem->>'trainee_id', '')::uuid,
         elem->>'trainee_name',
         (elem->>'order_index')::int
  FROM jsonb_array_elements(p_trainees) AS elem
  WHERE NULLIF(elem->>'trainee_id', '') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM daily_schedule_slot_trainees t
       WHERE t.slot_id = p_slot_id AND t.trainee_id = NULLIF(elem->>'trainee_id', '')::uuid);
END;
$$ LANGUAGE plpgsql SET search_path = public;
