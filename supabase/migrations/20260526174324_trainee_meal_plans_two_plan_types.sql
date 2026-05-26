-- ===========================================
-- trainee_meal_plans: support two plan types
-- ===========================================
-- Nutritionists need to give each trainee separate menus for workout days
-- and rest days. Add dedicated columns for each plan type and backfill
-- the existing single PDF as the workout-day plan.
--
-- The legacy `pdf_url` / `pdf_path` columns stay nullable for now so the
-- old read path keeps working through the deploy window. They can be
-- dropped in a later migration once nothing reads them anymore.

ALTER TABLE trainee_meal_plans
  ADD COLUMN IF NOT EXISTS workout_day_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS workout_day_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS rest_day_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS rest_day_pdf_path TEXT;

-- Backfill: existing single PDFs become the workout-day plan.
UPDATE trainee_meal_plans
SET
  workout_day_pdf_url = pdf_url,
  workout_day_pdf_path = pdf_path
WHERE pdf_url IS NOT NULL
  AND workout_day_pdf_url IS NULL;
