-- Add late-April 2026 shifts for לידור חי זינטי (23, 26, 27, 28, 29)
-- Sun-Thu start at 15:00 (no Friday in this batch)
-- All April 2026 dates are post-DST (DST started 2026-03-27) -> UTC+3
-- Keeps existing 1-21 April shifts intact; only clears these 5 dates before re-insert (idempotent)

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
  v_existing_count INT;
BEGIN
  -- Find trainer by name
  SELECT id, full_name INTO v_trainer_id, v_trainer_name
  FROM profiles
  WHERE full_name ILIKE '%לידור%זינטי%'
    AND role IN ('trainer', 'admin')
  LIMIT 1;

  -- Skip (not fail) when the trainer is absent: keeps `supabase db reset` and
  -- fresh environments working, where profiles is empty.
  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'Trainer לידור חי זינטי not found - skipping (fresh environment)';
    RETURN;
  END IF;

  RAISE NOTICE 'Found trainer: % (id: %)', v_trainer_name, v_trainer_id;

  -- Already-applied sentinel: skip re-runs so later-added trainer_shifts
  -- columns are not wiped by the delete+insert below.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-04-23 15:00:00+03'
      AND end_time = '2026-04-23 22:00:00+03'
  ) THEN
    RAISE NOTICE 'Late-April 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Capture prior values for the 5 target dates (audit trail before destructive op)
  SELECT COUNT(*) INTO v_existing_count
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date IN (
      DATE '2026-04-23', DATE '2026-04-26', DATE '2026-04-27',
      DATE '2026-04-28', DATE '2026-04-29'
    );
  RAISE NOTICE 'Existing shifts on target dates (will be replaced): %', v_existing_count;

  -- Delete only the 5 specific dates being inserted (preserves 1-21 April shifts)
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date IN (
      DATE '2026-04-23', DATE '2026-04-26', DATE '2026-04-27',
      DATE '2026-04-28', DATE '2026-04-29'
    );

  -- Insert new shifts (all post-DST, UTC+3)
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 23.4 (Thu) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-04-23 15:00:00+03', '2026-04-23 22:00:00+03'),
    -- 26.4 (Sun) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-04-26 15:00:00+03', '2026-04-26 23:00:00+03'),
    -- 27.4 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-04-27 15:00:00+03', '2026-04-27 20:00:00+03'),
    -- 28.4 (Tue) 15:00-16:00 (1h)
    (v_trainer_id, v_trainer_name, '2026-04-28 15:00:00+03', '2026-04-28 16:00:00+03'),
    -- 29.4 (Wed) 15:00-18:00 (3h)
    (v_trainer_id, v_trainer_name, '2026-04-29 15:00:00+03', '2026-04-29 18:00:00+03');

  RAISE NOTICE 'Inserted 5 late-April shifts for %', v_trainer_name;
END;
$$;
