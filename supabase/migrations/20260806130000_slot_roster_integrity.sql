-- ===========================================
-- SLOT ROSTER INTEGRITY — follow-up to 20260806120000 (code review findings)
--
-- 1. replace_slot_roster(): the roster replace was delete-then-insert as two
--    statements from the app; a failure between them permanently lost the
--    roster and left a slot violating the min-1-trainee invariant. One
--    plpgsql function = one transaction. Same idiom as
--    save_workout_program_grid (20260630140000).
--
-- 2. Partial unique index: the dialog dedupes linked trainees client-side,
--    but nothing stopped a direct server-action call from inserting the same
--    trainee twice into one slot — which Phase 2 sessions would then attach
--    to twice. Free-text rows (trainee_id IS NULL) are exempt.
-- ===========================================

-- SECURITY INVOKER (default): runs as the calling role, so the admin-only
-- RLS write policies on daily_schedule_slot_trainees still gate it.
CREATE OR REPLACE FUNCTION replace_slot_roster(p_slot_id UUID, p_trainees JSONB)
RETURNS void AS $$
BEGIN
  DELETE FROM daily_schedule_slot_trainees WHERE slot_id = p_slot_id;

  INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index)
  SELECT
    p_slot_id,
    NULLIF(elem->>'trainee_id', '')::uuid,
    elem->>'trainee_name',
    (elem->>'order_index')::int
  FROM jsonb_array_elements(p_trainees) AS elem;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_slot_trainees_unique_linked
  ON daily_schedule_slot_trainees(slot_id, trainee_id)
  WHERE trainee_id IS NOT NULL;
