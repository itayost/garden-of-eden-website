-- Trainer End-of-Shift Reports
-- Daily reports filled by trainers at the end of their shift

CREATE TABLE IF NOT EXISTS trainer_shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id),
  trainer_name TEXT NOT NULL,
  report_date DATE NOT NULL,

  -- Step 1: Basic Info
  trained_new_trainees BOOLEAN NOT NULL DEFAULT false,
  new_trainees_ids UUID[] DEFAULT '{}',
  new_trainees_details TEXT,

  -- Step 2: Trainee Issues
  has_discipline_issues BOOLEAN NOT NULL DEFAULT false,
  discipline_trainee_ids UUID[] DEFAULT '{}',
  discipline_details TEXT,

  has_injuries BOOLEAN NOT NULL DEFAULT false,
  injuries_trainee_ids UUID[] DEFAULT '{}',
  injuries_details TEXT,

  has_physical_limitations BOOLEAN NOT NULL DEFAULT false,
  limitations_trainee_ids UUID[] DEFAULT '{}',
  limitations_details TEXT,

  -- Step 3: Trainee Positives & Wellbeing
  has_achievements BOOLEAN NOT NULL DEFAULT false,
  achievements_trainee_ids UUID[] DEFAULT '{}',
  achievements_details TEXT,

  has_poor_mental_state BOOLEAN NOT NULL DEFAULT false,
  mental_state_trainee_ids UUID[] DEFAULT '{}',
  mental_state_details TEXT,

  has_complaints BOOLEAN NOT NULL DEFAULT false,
  complaints_trainee_ids UUID[] DEFAULT '{}',
  complaints_details TEXT,

  has_insufficient_attention BOOLEAN NOT NULL DEFAULT false,
  insufficient_attention_trainee_ids UUID[] DEFAULT '{}',
  insufficient_attention_details TEXT,

  has_pro_candidates BOOLEAN NOT NULL DEFAULT false,
  pro_candidates_trainee_ids UUID[] DEFAULT '{}',
  pro_candidates_details TEXT,

  -- Step 4: Parents & Visitors
  has_parent_seeking_staff BOOLEAN NOT NULL DEFAULT false,
  parent_seeking_details TEXT,

  has_external_visitors BOOLEAN NOT NULL DEFAULT false,
  external_visitors_details TEXT,

  has_parent_complaints BOOLEAN NOT NULL DEFAULT false,
  parent_complaints_details TEXT,

  -- Step 5: Facility
  facility_left_clean BOOLEAN NOT NULL DEFAULT true,
  facility_not_clean_reason TEXT,

  facility_cleaned_scheduled BOOLEAN NOT NULL DEFAULT true,
  facility_not_cleaned_reason TEXT,

  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One report per trainer per day
CREATE UNIQUE INDEX trainer_shift_reports_trainer_date_idx
  ON trainer_shift_reports(trainer_id, report_date);

-- Index for listing reports
CREATE INDEX trainer_shift_reports_date_idx
  ON trainer_shift_reports(report_date DESC);

CREATE INDEX trainer_shift_reports_trainer_idx
  ON trainer_shift_reports(trainer_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_shift_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shift_report_updated_at
  BEFORE UPDATE ON trainer_shift_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_report_updated_at();

-- RLS
ALTER TABLE trainer_shift_reports ENABLE ROW LEVEL SECURITY;

-- Trainers can insert their own reports
CREATE POLICY "Trainers can insert own reports"
  ON trainer_shift_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('trainer', 'admin')
    )
  );

-- Trainers can update their own reports
CREATE POLICY "Trainers can update own reports"
  ON trainer_shift_reports
  FOR UPDATE
  USING (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('trainer', 'admin')
    )
  );

-- Trainers can view their own reports
CREATE POLICY "Trainers can view own reports"
  ON trainer_shift_reports
  FOR SELECT
  USING (
    auth.uid() = trainer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('trainer', 'admin')
    )
  );

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON trainer_shift_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
