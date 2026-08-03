-- ===========================================
-- TRAINER TASKS (משימות למאמנים) + DAILY BRIEFS (בריף יומי)
--
-- trainer_tasks: an operational unit of work an admin assigns to exactly one
-- trainer, with a due date. This is staff work, NOT training content —
-- workout_programs / book_drills cover content assigned to trainees.
--
-- daily_briefs: one free-text note per calendar day, written by an admin and
-- read by all staff. There is no per-trainer or per-shift brief.
--
-- Notifications are DERIVED, not stored. "Overdue" is computed from due_date
-- against the Israel date; "closed and awaiting review" is a done row with a
-- NULL admin_seen_at. See docs/adr/0001-derived-task-notifications.md.
--
-- Every statement in this file is idempotent so a partially-applied migration
-- can be replayed safely.
-- ===========================================

DO $$ BEGIN
  CREATE TYPE trainer_task_status AS ENUM ('open', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- TABLES
-- ===========================================

CREATE TABLE IF NOT EXISTS trainer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL CHECK (title <> ''),
  description TEXT,

  -- Exactly one assignee. Assigning the same work to three trainers creates
  -- three rows, so each trainer closes their own and accountability is clear.
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Optional context tag only. This does NOT grant the trainee any access and
  -- does NOT establish a trainer-trainee relationship.
  trainee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  due_date DATE NOT NULL,
  status trainer_task_status NOT NULL DEFAULT 'open',

  created_by UUID NOT NULL REFERENCES profiles(id),
  -- Denormalized snapshot so the task survives author renames/deletions.
  created_by_name TEXT NOT NULL,

  -- Set when the trainer closes the task. Overwritten if the task is reopened
  -- and closed again — full cycle history is deliberately not kept.
  completion_note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),

  -- Set when an admin reopens a closed task.
  reopen_reason TEXT,

  -- NULL on a 'done' row means the admin has not acknowledged it yet.
  -- Cleared back to NULL on reopen so a re-closed task is reviewed again.
  -- Writable by admins only; enforced by trigger, see below.
  admin_seen_at TIMESTAMPTZ,

  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One brief per calendar day, globally.
  brief_date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL CHECK (content <> ''),

  -- The admin who first wrote this day's brief. Never rewritten on edit.
  author_id UUID NOT NULL REFERENCES profiles(id),
  author_name TEXT NOT NULL,

  -- The admin who last edited it, when that differs from the author.
  updated_by_id UUID REFERENCES profiles(id),
  updated_by_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- INDEXES (partial where the query is partial)
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_trainer_tasks_assignee
  ON trainer_tasks(assigned_to, status, due_date);

CREATE INDEX IF NOT EXISTS idx_trainer_tasks_overdue
  ON trainer_tasks(due_date)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_trainer_tasks_unseen
  ON trainer_tasks(completed_at DESC)
  WHERE status = 'done' AND admin_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_tasks_trainee
  ON trainer_tasks(trainee_id)
  WHERE trainee_id IS NOT NULL;

-- ===========================================
-- UPDATED_AT TRIGGERS (shared helper, per retention_notes convention)
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trainer_tasks_updated_at ON trainer_tasks;
CREATE TRIGGER set_trainer_tasks_updated_at
  BEFORE UPDATE ON trainer_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_daily_briefs_updated_at ON daily_briefs;
CREATE TRIGGER set_daily_briefs_updated_at
  BEFORE UPDATE ON daily_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- COLUMN GUARD (the real enforcement of what a trainer may write)
--
-- RLS restricts rows, never columns. Without this trigger a trainer holding
-- their own JWT and the public anon key could PATCH /rest/v1/trainer_tasks
-- directly and set admin_seen_at on their own row, removing the task from the
-- admin's review queue and badge without the admin ever seeing it. Pushing
-- due_date forward would hide it from the overdue list the same way.
--
-- A trainer may only move their own open task to done, and attach a note.
-- Everything else is admin-only.
-- ===========================================

CREATE OR REPLACE FUNCTION enforce_trainer_task_column_guard()
RETURNS trigger AS $$
BEGIN
  -- Service role and direct SQL (auth.uid() IS NULL) are trusted: they already
  -- bypass RLS, and cron/back-office scripts must stay able to correct rows.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_seen_at IS DISTINCT FROM OLD.admin_seen_at
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.trainee_id IS DISTINCT FROM OLD.trainee_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_by_name IS DISTINCT FROM OLD.created_by_name
     OR NEW.reopen_reason IS DISTINCT FROM OLD.reopen_reason
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
  THEN
    RAISE EXCEPTION 'מאמן רשאי לעדכן רק את סגירת המשימה שלו';
  END IF;

  -- The only transition a trainer may perform is open -> done.
  IF OLD.status IS DISTINCT FROM 'open'::trainer_task_status
     OR NEW.status IS DISTINCT FROM 'done'::trainer_task_status
  THEN
    RAISE EXCEPTION 'מאמן רשאי רק לסגור משימה פתוחה';
  END IF;

  -- Pin the completion stamp to the caller so one trainer cannot record
  -- another as having done the work.
  NEW.completed_by := auth.uid();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_trainer_task_columns ON trainer_tasks;
CREATE TRIGGER guard_trainer_task_columns
  BEFORE UPDATE ON trainer_tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_trainer_task_column_guard();

-- The author of a brief is fixed at creation; edits only move updated_by_*.
CREATE OR REPLACE FUNCTION enforce_daily_brief_author_immutable()
RETURNS trigger AS $$
BEGIN
  NEW.author_id := OLD.author_id;
  NEW.author_name := OLD.author_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_daily_brief_author ON daily_briefs;
CREATE TRIGGER guard_daily_brief_author
  BEFORE UPDATE ON daily_briefs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_daily_brief_author_immutable();

-- ===========================================
-- ROW LEVEL SECURITY — trainer_tasks
-- Staff-only. Trainees get no policy at all, so a linked trainee cannot read
-- the task that mentions them.
-- ===========================================

ALTER TABLE trainer_tasks ENABLE ROW LEVEL SECURITY;

-- Admins see every task.
DROP POLICY IF EXISTS "tasks_admin_select" ON trainer_tasks;
CREATE POLICY "tasks_admin_select" ON trainer_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- Trainers see only tasks assigned to them.
DROP POLICY IF EXISTS "tasks_trainer_select_own" ON trainer_tasks;
CREATE POLICY "tasks_trainer_select_own" ON trainer_tasks
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- Only admins create tasks, including on behalf of another trainer.
-- Without this dedicated INSERT policy the admin-creates-for-trainer insert
-- fails silently — the same trap that produced 20260216200842 for shifts.
DROP POLICY IF EXISTS "tasks_admin_insert" ON trainer_tasks;
CREATE POLICY "tasks_admin_insert" ON trainer_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- Admins can update any task (edit, reopen, cancel, acknowledge).
DROP POLICY IF EXISTS "tasks_admin_update" ON trainer_tasks;
CREATE POLICY "tasks_admin_update" ON trainer_tasks
  FOR UPDATE
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

-- A trainer can update only their own row and cannot reassign it away from
-- themselves. WHICH COLUMNS they may write is enforced by
-- guard_trainer_task_columns above, because RLS cannot express that.
DROP POLICY IF EXISTS "tasks_trainer_update_own" ON trainer_tasks;
CREATE POLICY "tasks_trainer_update_own" ON trainer_tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    assigned_to = (SELECT auth.uid())
  );

-- Hard DELETE is blocked. Irrelevant tasks are cancelled, keeping the record.
DROP POLICY IF EXISTS "tasks_no_hard_delete" ON trainer_tasks;
CREATE POLICY "tasks_no_hard_delete" ON trainer_tasks
  FOR DELETE
  TO authenticated
  USING (false);

-- ===========================================
-- ROW LEVEL SECURITY — daily_briefs
-- ===========================================

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

-- All staff read the brief.
DROP POLICY IF EXISTS "briefs_staff_select" ON daily_briefs;
CREATE POLICY "briefs_staff_select" ON daily_briefs
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

-- Only admins write it. author_id is pinned to the caller on insert so a brief
-- cannot be attributed to someone else.
DROP POLICY IF EXISTS "briefs_admin_insert" ON daily_briefs;
CREATE POLICY "briefs_admin_insert" ON daily_briefs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- Any admin may edit any day's brief. The author is preserved by
-- guard_daily_brief_author, so editing does not reattribute authorship.
DROP POLICY IF EXISTS "briefs_admin_update" ON daily_briefs;
CREATE POLICY "briefs_admin_update" ON daily_briefs
  FOR UPDATE
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

DROP POLICY IF EXISTS "briefs_no_hard_delete" ON daily_briefs;
CREATE POLICY "briefs_no_hard_delete" ON daily_briefs
  FOR DELETE
  TO authenticated
  USING (false);
