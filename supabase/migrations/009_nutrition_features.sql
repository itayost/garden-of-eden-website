-- ===============================================
-- NUTRITION FEATURES
-- Sleep analytics, meal plans, recommendations
-- ===============================================

-- ===========================================
-- TRAINEE MEAL PLANS
-- ===========================================
CREATE TABLE trainee_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Weekly meal plan structure (JSONB for flexibility)
  -- Format: { "sunday": { "breakfast": ["item1"], "lunch": [...], "dinner": [...], "snacks": [...] }, ... }
  meal_plan JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_meal_plans_user ON trainee_meal_plans(user_id) WHERE deleted_at IS NULL;

-- ===========================================
-- NUTRITION RECOMMENDATIONS
-- ===========================================
CREATE TABLE nutrition_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Recommendation content
  recommendation_text TEXT NOT NULL,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_recommendations_user ON nutrition_recommendations(user_id) WHERE deleted_at IS NULL;

-- ===========================================
-- ROW LEVEL SECURITY - MEAL PLANS
-- ===========================================
ALTER TABLE trainee_meal_plans ENABLE ROW LEVEL SECURITY;

-- Trainees can view their own meal plans
CREATE POLICY "Trainees can view own meal plans" ON trainee_meal_plans
  FOR SELECT USING (
    auth.uid() = user_id AND deleted_at IS NULL
  );

-- Admins and trainers can view all meal plans
CREATE POLICY "Admins can view all meal plans" ON trainee_meal_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can insert meal plans
CREATE POLICY "Admins can insert meal plans" ON trainee_meal_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can update meal plans
CREATE POLICY "Admins can update meal plans" ON trainee_meal_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- ===========================================
-- ROW LEVEL SECURITY - RECOMMENDATIONS
-- ===========================================
ALTER TABLE nutrition_recommendations ENABLE ROW LEVEL SECURITY;

-- Trainees can view their own recommendations
CREATE POLICY "Trainees can view own recommendations" ON nutrition_recommendations
  FOR SELECT USING (
    auth.uid() = user_id AND deleted_at IS NULL
  );

-- Admins and trainers can view all recommendations
CREATE POLICY "Admins can view all recommendations" ON nutrition_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can insert recommendations
CREATE POLICY "Admins can insert recommendations" ON nutrition_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- Only admins and trainers can update recommendations
CREATE POLICY "Admins can update recommendations" ON nutrition_recommendations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

-- ===========================================
-- UPDATE TRIGGERS FOR updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_nutrition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON trainee_meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_updated_at();

CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON nutrition_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_nutrition_updated_at();
