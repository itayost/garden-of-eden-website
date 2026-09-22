-- Many trainers on one training hour, step 1 of 2 (spec 2026-09-22).
--
-- Additive on purpose. The old trainer_id / trainer_name columns stay exactly
-- where they are, so the code running in production right now keeps reading
-- them and never notices this ran. Migration B drops them, after the new code
-- is deployed. Splitting it this way is what keeps the window shut: there is
-- never a moment when the schema and the running code disagree.

CREATE TABLE IF NOT EXISTS public.daily_schedule_slot_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  -- Nullable with SET NULL, not NOT NULL with CASCADE. trainer_name is a
  -- snapshot kept on purpose so the board stays readable after a trainer is
  -- renamed or deleted; CASCADE would take the row and the name with it.
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trainer_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT slot_trainers_name_length CHECK (char_length(trainer_name) <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_trainers_unique
  ON public.daily_schedule_slot_trainers (slot_id, trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slot_trainers_slot
  ON public.daily_schedule_slot_trainers (slot_id, order_index);
CREATE INDEX IF NOT EXISTS idx_slot_trainers_trainer
  ON public.daily_schedule_slot_trainers (trainer_id) WHERE trainer_id IS NOT NULL;

ALTER TABLE public.daily_schedule_slot_trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_trainers_staff_select" ON public.daily_schedule_slot_trainers;
CREATE POLICY "slot_trainers_staff_select" ON public.daily_schedule_slot_trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer') AND p.deleted_at IS NULL));

DROP POLICY IF EXISTS "slot_trainers_staff_write" ON public.daily_schedule_slot_trainers;
CREATE POLICY "slot_trainers_staff_write" ON public.daily_schedule_slot_trainers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer')
      AND p.is_active = true AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer')
      AND p.is_active = true AND p.deleted_at IS NULL));

CREATE TABLE IF NOT EXISTS public.weekly_schedule_band_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.weekly_schedule_bands(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trainer_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT band_trainers_name_length CHECK (char_length(trainer_name) <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_band_trainers_unique
  ON public.weekly_schedule_band_trainers (band_id, trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_band_trainers_band
  ON public.weekly_schedule_band_trainers (band_id, order_index);
CREATE INDEX IF NOT EXISTS idx_band_trainers_trainer
  ON public.weekly_schedule_band_trainers (trainer_id) WHERE trainer_id IS NOT NULL;

ALTER TABLE public.weekly_schedule_band_trainers ENABLE ROW LEVEL SECURITY;

-- A band is an admin decision today and stays one: staff read, admins write.
DROP POLICY IF EXISTS "band_trainers_staff_select" ON public.weekly_schedule_band_trainers;
CREATE POLICY "band_trainers_staff_select" ON public.weekly_schedule_band_trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer') AND p.deleted_at IS NULL));

DROP POLICY IF EXISTS "band_trainers_admin_write" ON public.weekly_schedule_band_trainers;
CREATE POLICY "band_trainers_admin_write" ON public.weekly_schedule_band_trainers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
      AND p.is_active = true AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
      AND p.is_active = true AND p.deleted_at IS NULL));

-- Backfill. Every band has a trainer today; nine slots have none and get no row.
INSERT INTO public.weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT b.id, b.trainer_id, b.trainer_name, 0 FROM public.weekly_schedule_bands b
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT s.id, s.trainer_id, COALESCE(s.trainer_name, 'מאמן'), 0
  FROM public.daily_schedule_slots s
 WHERE s.trainer_id IS NOT NULL
ON CONFLICT DO NOTHING;
