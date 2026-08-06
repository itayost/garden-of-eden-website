-- Fix assessment dates: all 2024 dates should be 2025
-- The year was incorrectly set during script import; month and day are correct.
UPDATE player_assessments
SET assessment_date = assessment_date + INTERVAL '1 year'
WHERE EXTRACT(YEAR FROM assessment_date) = 2024;
