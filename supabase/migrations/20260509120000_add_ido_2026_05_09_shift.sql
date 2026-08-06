-- Add 2026-05-09 (Saturday) shift for עידו: 16:30-18:10 (1h 40m)
-- Post-DST (DST started 2026-03-27) -> UTC+3
-- Idempotent: skips insert if an exact 16:30-18:10 shift already exists on this date

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
  v_match_count INT;
  v_total_on_date INT;
  v_target_start TIMESTAMPTZ := '2026-05-09 16:30:00+03';
  v_target_end   TIMESTAMPTZ := '2026-05-09 18:10:00+03';
BEGIN
  -- Find trainer by name (only one trainer named עידו per user confirmation)
  SELECT id, full_name INTO v_trainer_id, v_trainer_name
  FROM profiles
  WHERE full_name ILIKE '%עידו%'
    AND role IN ('trainer', 'admin')
  LIMIT 1;

  -- Skip (not fail) when the trainer is absent: keeps `supabase db reset` and
  -- fresh environments working, where profiles is empty.
  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'Trainer עידו not found - skipping (fresh environment)';
    RETURN;
  END IF;

  RAISE NOTICE 'Found trainer: % (id: %)', v_trainer_name, v_trainer_id;

  -- Audit: log existing shifts on this date (preserved, not deleted)
  SELECT COUNT(*) INTO v_total_on_date
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date = DATE '2026-05-09';

  RAISE NOTICE 'Existing shifts on 2026-05-09 (preserved): %', v_total_on_date;

  -- Idempotency check: exact same start/end already inserted?
  SELECT COUNT(*) INTO v_match_count
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time = v_target_start
    AND end_time   = v_target_end;

  IF v_match_count > 0 THEN
    RAISE NOTICE 'Shift 16:30-18:10 on 2026-05-09 already exists - skipping insert';
    RETURN;
  END IF;

  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time)
  VALUES (v_trainer_id, v_trainer_name, v_target_start, v_target_end);

  RAISE NOTICE 'Inserted shift 16:30-18:10 on 2026-05-09 for %', v_trainer_name;
END;
$$;
