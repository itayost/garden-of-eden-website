-- Projecting bookable hours upserts with ON CONFLICT (band_id, schedule_date).
-- Postgres matches a partial unique index only when the conflict target repeats
-- its WHERE clause, which PostgREST cannot send, so every projection failed with
-- 42P10 and no bookable slot was ever created. A full unique index serves the
-- same purpose: NULLs stay distinct, so hand-made slots (band_id NULL) are
-- unaffected.

DROP INDEX IF EXISTS public.daily_schedule_slots_band_date_key;

CREATE UNIQUE INDEX daily_schedule_slots_band_date_key
  ON public.daily_schedule_slots (band_id, schedule_date);
