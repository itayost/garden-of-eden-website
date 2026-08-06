-- ===========================================
-- DAILY SCHEDULE (לוח יומי) — Phase 1 of the studio training pipeline
--
-- A slot is the atom: (date, hour, trainer, focus, location, trainee roster).
-- Two trainers at the same hour with different groups are two slots.
--
-- This replaces the hand-typed WhatsApp schedule message as the source of
-- truth; the message itself is generated from these rows (schedule-text.ts).
-- The free-text daily_briefs table stays for general announcements.
--
-- The schedule is admin-authored, NOT pulled from Arbox.
-- See docs/adr/0002-admin-authored-schedule.md.
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

CREATE TABLE IF NOT EXISTS daily_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,

  -- The trainer taking this group. Nullable: a slot can be written before
  -- deciding who takes it.
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Denormalized snapshot so the schedule survives renames/deletions.
  trainer_name TEXT,

  -- What this group works on, e.g. "זריזות מהירות טכניקה עם כדור".
  focus_he TEXT,
  -- Optional free text, e.g. "מגרש" / "סטודיו".
  location_he TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_schedule_slot_trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  slot_id UUID NOT NULL REFERENCES daily_schedule_slots(id) ON DELETE CASCADE,

  -- Nullable ON PURPOSE: the hand-typed lists include names that are not
  -- system accounts, and building the schedule must not force account
  -- creation. The picker fills both columns; free-text entry fills name only.
  -- Phase 2 (per-trainee sessions) only attaches to rows with a trainee_id.
  trainee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trainee_name TEXT NOT NULL CHECK (trainee_name <> ''),

  order_index INTEGER NOT NULL DEFAULT 0
);

-- ===========================================
-- INDEXES
-- ===========================================

-- The page always loads one day.
CREATE INDEX IF NOT EXISTS idx_schedule_slots_date
  ON daily_schedule_slots(schedule_date, start_time);

CREATE INDEX IF NOT EXISTS idx_schedule_slot_trainees_slot
  ON daily_schedule_slot_trainees(slot_id, order_index);

-- Phase 2 joins sessions to slots by trainee.
CREATE INDEX IF NOT EXISTS idx_schedule_slot_trainees_trainee
  ON daily_schedule_slot_trainees(trainee_id)
  WHERE trainee_id IS NOT NULL;

-- ===========================================
-- UPDATED_AT TRIGGER (shared helper, retention_notes convention)
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_daily_schedule_slots_updated_at ON daily_schedule_slots;
CREATE TRIGGER set_daily_schedule_slots_updated_at
  BEFORE UPDATE ON daily_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ROW LEVEL SECURITY
-- Staff-only. Trainees get no policy at all — a trainee never sees the day's
-- roster, only (in Phase 3) his own session.
--
-- DELETE is allowed for admins, unlike trainer_tasks: slots are planning
-- data, not accountability records. A wrong slot is deleted, not cancelled.
-- ===========================================

ALTER TABLE daily_schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedule_slot_trainees ENABLE ROW LEVEL SECURITY;

-- All staff read the schedule.
DROP POLICY IF EXISTS "schedule_slots_staff_select" ON daily_schedule_slots;
CREATE POLICY "schedule_slots_staff_select" ON daily_schedule_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- Only admins build the schedule.
DROP POLICY IF EXISTS "schedule_slots_admin_write" ON daily_schedule_slots;
CREATE POLICY "schedule_slots_admin_write" ON daily_schedule_slots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "schedule_slot_trainees_staff_select" ON daily_schedule_slot_trainees;
CREATE POLICY "schedule_slot_trainees_staff_select" ON daily_schedule_slot_trainees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "schedule_slot_trainees_admin_write" ON daily_schedule_slot_trainees;
CREATE POLICY "schedule_slot_trainees_admin_write" ON daily_schedule_slot_trainees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );
