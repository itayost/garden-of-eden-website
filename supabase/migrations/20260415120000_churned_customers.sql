-- Churned customers: global manual list of customers who left the academy
CREATE TABLE churned_customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  end_date     date NOT NULL,
  note         text NOT NULL DEFAULT '',
  note_color   text NOT NULL DEFAULT 'none'
                 CHECK (note_color IN ('none', 'yellow', 'red', 'green')),
  author_id    uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_churned_customers_created ON churned_customers(created_at DESC);

-- RLS
ALTER TABLE churned_customers ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer
CREATE POLICY "Admin and trainers can read churned customers"
  ON churned_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT: admin and trainer (must set author_id to self)
CREATE POLICY "Admin and trainers can create churned customers"
  ON churned_customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND author_id = auth.uid()
  );

-- UPDATE: author can update own; admin can update any
CREATE POLICY "Authors and admins can update churned customers"
  ON churned_customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
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

-- DELETE: author can delete own; admin can delete any
CREATE POLICY "Authors and admins can delete churned customers"
  ON churned_customers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  );
