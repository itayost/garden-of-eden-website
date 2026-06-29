-- Allow trainers (not just admins) to manage lead tabs.
-- Mirrors the existing admin_trainer_select policy so create/rename/reorder and
-- soft-delete (UPDATE deleted_at) all work for trainers. Moving a tab's leads to a
-- destination on delete already works for trainers via the leads admin_trainer_all
-- policy, so no leads-table change is needed here.

DROP POLICY IF EXISTS "admin_insert" ON lead_tabs;
CREATE POLICY "admin_trainer_insert" ON lead_tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'trainer')
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "admin_update" ON lead_tabs;
CREATE POLICY "admin_trainer_update" ON lead_tabs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'trainer')
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'trainer')
        AND deleted_at IS NULL
    )
  );
