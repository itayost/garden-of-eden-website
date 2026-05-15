-- ===========================================
-- NUTRITION MEASUREMENTS
-- Per-visit body data: height, weight, BMI, percentiles, body-fat %.
-- ===========================================

CREATE TABLE nutrition_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,

  age INTEGER
    CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  height_cm DECIMAL(5,1)
    CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 300)),
  height_percentile DECIMAL(5,2)
    CHECK (height_percentile IS NULL OR (height_percentile >= 0 AND height_percentile <= 100)),
  weight_kg DECIMAL(5,2)
    CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 500)),
  bmi DECIMAL(5,2)
    CHECK (bmi IS NULL OR (bmi > 0 AND bmi < 200)),
  bmi_percentile DECIMAL(5,2)
    CHECK (bmi_percentile IS NULL OR (bmi_percentile >= 0 AND bmi_percentile <= 100)),
  body_fat_percentage DECIMAL(5,2)
    CHECK (body_fat_percentage IS NULL OR (body_fat_percentage >= 0 AND body_fat_percentage <= 100)),

  notes TEXT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_nutrition_measurements_user_date
  ON nutrition_measurements(user_id, measurement_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_nutrition_measurements_created
  ON nutrition_measurements(created_at DESC);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE nutrition_measurements ENABLE ROW LEVEL SECURITY;

-- Trainees can view their own non-deleted measurements.
CREATE POLICY "Trainees can view own measurements" ON nutrition_measurements
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Admins and trainers can view all measurements (including soft-deleted, for audit).
CREATE POLICY "Admins and trainers can view all measurements" ON nutrition_measurements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can insert measurements.
CREATE POLICY "Admins and trainers can insert measurements" ON nutrition_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can update measurements (covers the soft-delete write).
CREATE POLICY "Admins and trainers can update measurements" ON nutrition_measurements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Hard DELETE is blocked. The app soft-deletes via UPDATE only.
CREATE POLICY "No hard delete measurements" ON nutrition_measurements
  FOR DELETE
  TO authenticated
  USING (false);

-- ===========================================
-- updated_at trigger (reuses function from migration 009)
-- ===========================================
CREATE TRIGGER update_nutrition_measurements_updated_at
  BEFORE UPDATE ON nutrition_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_updated_at();
