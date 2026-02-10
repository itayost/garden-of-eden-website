-- Add PDF support to trainee_meal_plans
-- Allows storing a PDF URL instead of the JSONB meal plan structure

-- Make meal_plan nullable (new entries will use PDF instead)
ALTER TABLE trainee_meal_plans
  ALTER COLUMN meal_plan DROP NOT NULL,
  ALTER COLUMN meal_plan SET DEFAULT NULL;

-- Add PDF storage columns
ALTER TABLE trainee_meal_plans
  ADD COLUMN pdf_url TEXT,
  ADD COLUMN pdf_path TEXT;
