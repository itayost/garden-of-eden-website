-- idx_schedule_slots_band_date (partial, non-unique) covers the same columns as
-- the full unique daily_schedule_slots_band_date_key, which now serves every
-- lookup by (band_id, schedule_date). Keeping both only doubles the write cost.

DROP INDEX IF EXISTS public.idx_schedule_slots_band_date;
