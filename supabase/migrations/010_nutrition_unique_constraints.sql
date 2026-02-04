-- ===============================================
-- NUTRITION: Unique constraints per user
-- Prevents duplicate active meal plans / recommendations
-- ===============================================

CREATE UNIQUE INDEX idx_meal_plans_user_unique
  ON trainee_meal_plans(user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_recommendations_user_unique
  ON nutrition_recommendations(user_id)
  WHERE deleted_at IS NULL;
