-- ===========================================
-- Daily schedule: staff build the board, not just admins.
--
-- The board is written where the work happens — a trainer standing in the
-- studio with a phone adds the slot he just agreed on. Requiring an admin at a
-- desktop meant the day was recorded after the fact, or not at all.
--
-- This mirrors phase 2 of the same pipeline: training_sessions_staff_all
-- already lets trainers build the sessions that hang off these slots. The
-- schedule was the odd one out.
--
-- Slots are operational data, not accountability records — a wrong slot is
-- deleted, not cancelled — so trainers get the full create/update/delete right
-- over the shared board, including each other's slots.
--
-- The write policies additionally require is_active, which the read policies
-- do not. Deactivating a trainer only flips the profile column — it revokes no
-- session — so without this a deactivated trainer keeps writing to the board
-- until their token expires. Reads stay open so a session that is already on
-- the page does not go blank mid-shift.
--
-- Whole-day duplication stays admin-only. It has no separate policy: the gate
-- lives in duplicateDayAction (verifyAdmin), because RLS cannot distinguish a
-- bulk copy from the single inserts it is made of. Note that this is an
-- ergonomic guard, not a containment boundary — a trainer can still build or
-- clear a whole day one slot at a time.
-- ===========================================

-- INSERT is split out from UPDATE/DELETE for one reason: it can pin
-- created_by to the caller. The anon key sits in every staff browser, so these
-- tables are writable through PostgREST directly, bypassing every Zod rule in
-- the server actions — including who an inserted row claims to be authored by.
-- Pinning it here means slot authorship is worth something.
--
-- UPDATE deliberately does not carry the same predicate: it would have to hold
-- for the row as it ends up, and staff legitimately edit each other's slots,
-- where created_by stays the original author's. Rewriting created_by on an
-- existing row therefore remains possible from a crafted call; pinning that
-- too needs a trigger, which is not worth it while created_by is provenance
-- and not an audit record.
DROP POLICY IF EXISTS "schedule_slots_admin_write" ON daily_schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_staff_write" ON daily_schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_staff_insert" ON daily_schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_staff_update" ON daily_schedule_slots;
DROP POLICY IF EXISTS "schedule_slots_staff_delete" ON daily_schedule_slots;

CREATE POLICY "schedule_slots_staff_insert" ON daily_schedule_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "schedule_slots_staff_update" ON daily_schedule_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "schedule_slots_staff_delete" ON daily_schedule_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

-- The roster is replaced through replace_slot_roster(), which is SECURITY
-- INVOKER — it writes as the caller, so this policy is what governs it.
DROP POLICY IF EXISTS "schedule_slot_trainees_admin_write" ON daily_schedule_slot_trainees;
DROP POLICY IF EXISTS "schedule_slot_trainees_staff_write" ON daily_schedule_slot_trainees;
CREATE POLICY "schedule_slot_trainees_staff_write" ON daily_schedule_slot_trainees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

-- ===========================================
-- Length bounds at the DB layer.
--
-- The same PostgREST reasoning as above: the Zod caps (300 chars of free text,
-- 100 of name) only exist inside the server actions, and these tables are now
-- writable by every trainer. These mirror the schema in
-- src/lib/validations/schedule.ts — keep the two in step.
--
-- CHECK passes on NULL, which is what the nullable columns want. DROP + ADD
-- keeps the file replayable like the rest of this feature's migrations.
-- ===========================================

ALTER TABLE daily_schedule_slots
  DROP CONSTRAINT IF EXISTS schedule_slots_focus_length;
ALTER TABLE daily_schedule_slots
  ADD CONSTRAINT schedule_slots_focus_length
  CHECK (char_length(focus_he) <= 300);

ALTER TABLE daily_schedule_slots
  DROP CONSTRAINT IF EXISTS schedule_slots_location_length;
ALTER TABLE daily_schedule_slots
  ADD CONSTRAINT schedule_slots_location_length
  CHECK (char_length(location_he) <= 300);

ALTER TABLE daily_schedule_slot_trainees
  DROP CONSTRAINT IF EXISTS schedule_slot_trainees_name_length;
ALTER TABLE daily_schedule_slot_trainees
  ADD CONSTRAINT schedule_slot_trainees_name_length
  CHECK (char_length(trainee_name) <= 100);

-- Verification after applying (DROP POLICY matches by exact name, so a stale
-- permissive policy under the old name would survive a rename unnoticed):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename LIKE 'daily_schedule%' ORDER BY 1, 2;
-- Expect six rows and none named *_admin_write:
--   daily_schedule_slots         staff_select / staff_insert / staff_update / staff_delete
--   daily_schedule_slot_trainees staff_select / staff_write (ALL)
