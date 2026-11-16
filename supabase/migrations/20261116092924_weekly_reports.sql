-- Weekly reports, spec docs/superpowers/specs/2026-11-11-weekly-report-design.md
-- (plan docs/superpowers/plans/2026-11-16-weekly-report-approval.md).
--
-- Expand only: three new tables. Apply this BEFORE deploying the code, which
-- reads and writes them; the code running today never touches them. Safe to
-- rerun. Needs set_row_updated_at() (20260911120000).
--
-- The tables are read and written only by server code with the service role:
-- RLS is on with no policies, and anon and authenticated have no grants.

SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.weekly_report_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'off'
    CONSTRAINT weekly_report_settings_mode_known CHECK (mode IN ('off', 'approval', 'automatic')),
  birth_years smallint[]
    CONSTRAINT weekly_report_settings_birth_years_sane CHECK (
      birth_years IS NULL OR (
        cardinality(birth_years) BETWEEN 1 AND 30
        AND 1950 <= ALL (birth_years) AND 2030 >= ALL (birth_years)
      )
    ),
  missed_you boolean NOT NULL DEFAULT false,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_report_settings_changed_by_idx
  ON public.weekly_report_settings (changed_by);

COMMENT ON TABLE public.weekly_report_settings IS
  'Weekly report mode per branch (off, approval, automatic), the pilot birth years (null = all) and whether "התגעגענו" goes out. Written by saveReportSettingsAction with the service role.';

CREATE TABLE IF NOT EXISTS public.weekly_report_runs (
  week_start date PRIMARY KEY
    CONSTRAINT weekly_report_runs_friday CHECK (extract(isodow FROM week_start) = 5),
  batch_id text,
  model text NOT NULL,
  prompt_version text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  batch_collected_at timestamptz,
  finished_at timestamptz
);

COMMENT ON TABLE public.weekly_report_runs IS
  'One writing run per Report week: the Message Batches id and when it was collected. Written by the weekly-reports-write cron with the service role.';

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL
    CONSTRAINT weekly_reports_friday CHECK (extract(isodow FROM week_start) = 5),
  kind text NOT NULL
    CONSTRAINT weekly_reports_kind_known CHECK (kind IN ('report', 'missed_you', 'absent')),
  status text NOT NULL
    CONSTRAINT weekly_reports_status_known CHECK (
      status IN ('pending', 'held', 'approved', 'sent', 'not_sent', 'listed')
    ),
  branch_ids uuid[] NOT NULL,
  hold_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  fact_sheet jsonb,
  model text,
  prompt_version text,
  original_output jsonb,
  player_text text,
  parent_text text,
  drill_ids uuid[] NOT NULL DEFAULT '{}',
  usage jsonb,
  written_at timestamptz,
  edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at timestamptz,
  edit_ratio numeric(4,3) CONSTRAINT weekly_reports_edit_ratio_range CHECK (edit_ratio BETWEEN 0 AND 1),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_automatically boolean NOT NULL DEFAULT false,
  held_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  held_at timestamptz,
  sent_at timestamptz,
  parent_message_id text,
  parent_skip_reason text,
  parent_first_opened_at timestamptz,
  player_first_opened_at timestamptz,
  flagged_wrong_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  flagged_wrong_at timestamptz,
  flagged_wrong_reason text,
  sampled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_once_a_week UNIQUE (trainee_id, week_start),
  CONSTRAINT weekly_reports_absent_is_listed CHECK ((kind = 'absent') = (status = 'listed')),
  CONSTRAINT weekly_reports_sent_has_time CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS weekly_reports_week_status_idx ON public.weekly_reports (week_start, status);
CREATE INDEX IF NOT EXISTS weekly_reports_branch_ids_idx ON public.weekly_reports USING gin (branch_ids);
CREATE INDEX IF NOT EXISTS weekly_reports_edited_by_idx ON public.weekly_reports (edited_by);
CREATE INDEX IF NOT EXISTS weekly_reports_approved_by_idx ON public.weekly_reports (approved_by);
CREATE INDEX IF NOT EXISTS weekly_reports_held_by_idx ON public.weekly_reports (held_by);
CREATE INDEX IF NOT EXISTS weekly_reports_flagged_wrong_by_idx ON public.weekly_reports (flagged_wrong_by);

COMMENT ON TABLE public.weekly_reports IS
  'One Weekly report, "התגעגענו" or "לא הגיעו 3 שבועות" row per Trainee per Report week (Friday start). Written by the weekly-reports cron jobs and the queue actions with the service role.';
COMMENT ON COLUMN public.weekly_reports.branch_ids IS
  'The Trainee''s report branches when the row was made; staff scope filters on it.';
COMMENT ON COLUMN public.weekly_reports.hold_reasons IS
  'Array of {code, text}. Text problems are recomputed on every edit and rewrite; sensitive and manual ones stay until a person approves.';
COMMENT ON COLUMN public.weekly_reports.fact_sheet IS
  '{sheet, body}: sheet is exactly what the model saw; body (measurements, dietitian note) is shown by code and never sent to the model.';

DROP TRIGGER IF EXISTS weekly_reports_updated_at ON public.weekly_reports;
CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.weekly_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weekly_report_settings FROM anon, authenticated;
REVOKE ALL ON public.weekly_report_runs FROM anon, authenticated;
REVOKE ALL ON public.weekly_reports FROM anon, authenticated;
