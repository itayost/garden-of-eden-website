-- Many trainers on one training hour, step 2 of 2 (spec 2026-09-22).
--
-- Runs only after the code that reads the junction tables is deployed. The
-- re-backfill closes the one window the split leaves: a slot or band written
-- by the OLD code between migration A and the deploy carries the column and no
-- link row, and without this it would read from now on as having no trainer.
--
-- The guard is NOT EXISTS on the parent rather than on the pair: a row the new
-- code already wrote has its links, and re-adding the old column's trainer
-- would append a duplicate under a different order.

INSERT INTO public.weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT b.id, b.trainer_id, b.trainer_name, 0
  FROM public.weekly_schedule_bands b
 WHERE b.trainer_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.weekly_schedule_band_trainers t WHERE t.band_id = b.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT s.id, s.trainer_id, COALESCE(s.trainer_name, 'מאמן'), 0
  FROM public.daily_schedule_slots s
 WHERE s.trainer_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.daily_schedule_slot_trainers t WHERE t.slot_id = s.id)
ON CONFLICT DO NOTHING;

ALTER TABLE public.weekly_schedule_bands
  DROP COLUMN IF EXISTS trainer_id,
  DROP COLUMN IF EXISTS trainer_name;

ALTER TABLE public.daily_schedule_slots
  DROP COLUMN IF EXISTS trainer_id,
  DROP COLUMN IF EXISTS trainer_name;
