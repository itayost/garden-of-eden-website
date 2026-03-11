-- Drop unused columns from nutrition_forms that were never collected by the form UI
ALTER TABLE nutrition_forms
  DROP COLUMN IF EXISTS bloating_frequency,
  DROP COLUMN IF EXISTS stomach_pain,
  DROP COLUMN IF EXISTS bowel_frequency,
  DROP COLUMN IF EXISTS stool_consistency,
  DROP COLUMN IF EXISTS overuse_injuries,
  DROP COLUMN IF EXISTS illness_interruptions,
  DROP COLUMN IF EXISTS max_days_missed,
  DROP COLUMN IF EXISTS fatigue_level,
  DROP COLUMN IF EXISTS concentration,
  DROP COLUMN IF EXISTS energy_level,
  DROP COLUMN IF EXISTS muscle_soreness,
  DROP COLUMN IF EXISTS physical_exhaustion,
  DROP COLUMN IF EXISTS preparedness,
  DROP COLUMN IF EXISTS overall_energy;
