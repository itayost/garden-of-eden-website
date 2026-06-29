-- Open churned_customers ("לקוחות שעזבו") edit/delete to ALL trainers, not just
-- the record's author. Mirrors the existing SELECT/INSERT policies which already
-- allow admin+trainer. Replaces the author-restricted UPDATE/DELETE policies from
-- 20260415120000_churned_customers.sql with plain admin-or-trainer checks.

DROP POLICY IF EXISTS "Authors and admins can update churned customers" ON churned_customers;
CREATE POLICY "Admin and trainers can update churned customers"
  ON churned_customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Authors and admins can delete churned customers" ON churned_customers;
CREATE POLICY "Admin and trainers can delete churned customers"
  ON churned_customers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );
