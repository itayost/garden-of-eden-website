-- Goal proposals and the metric-to-book map, spec
-- docs/superpowers/specs/2026-11-11-weekly-report-design.md ("Goal proposals
-- (phase 3)"), plan docs/superpowers/plans/2026-11-16-goal-proposals.md.
--
-- Expand only: three new tables and one function. Apply this BEFORE deploying
-- the code, which reads and writes them; the code running today never touches
-- them. Safe to rerun. Needs set_row_updated_at() (20260911120000).
--
-- The tables are read and written only by server code with the service role:
-- RLS is on with no policies, and anon and authenticated have no grants. The
-- first draft of the map is the next migration (book_parameter_metrics_seed).

SET LOCAL lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- The map: which Development book parameters train which Assessment metric
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.book_parameter_metrics (
  parameter_id uuid NOT NULL REFERENCES public.book_parameters(id) ON DELETE CASCADE,
  metric_key text NOT NULL
    CONSTRAINT book_parameter_metrics_metric_known CHECK (metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_right_foot', 'kick_power_left_foot',
      'shuffle_10m', 'sprint_10m_h', 'sprint_10m_h_ball', 'envelope', 'envelope_ball'
    )),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_parameter_metrics_pkey PRIMARY KEY (parameter_id, metric_key)
);

CREATE INDEX IF NOT EXISTS book_parameter_metrics_metric_key_idx
  ON public.book_parameter_metrics (metric_key);
CREATE INDEX IF NOT EXISTS book_parameter_metrics_created_by_idx
  ON public.book_parameter_metrics (created_by);

COMMENT ON TABLE public.book_parameter_metrics IS
  'Which Development book parameters train which Assessment metric (the 18 Goal metrics). Feeds the drills of the Weekly report and of Goal proposals. Written by saveMetricParametersAction (Admins, /admin/book/metrics) with the service role.';

-- ---------------------------------------------------------------------------
-- Goal proposals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.player_assessments(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_ids uuid[] NOT NULL,
  metric_key text NOT NULL
    CONSTRAINT goal_proposals_metric_known CHECK (metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_right_foot', 'kick_power_left_foot',
      'shuffle_10m', 'sprint_10m_h', 'sprint_10m_h_ball', 'envelope', 'envelope_ball'
    )),
  rank smallint NOT NULL CONSTRAINT goal_proposals_rank_range CHECK (rank BETWEEN 1 AND 3),
  baseline_value numeric(10,3) NOT NULL CONSTRAINT goal_proposals_baseline_sane CHECK (baseline_value >= 0),
  target_value numeric(10,3) NOT NULL CONSTRAINT goal_proposals_target_positive CHECK (target_value > 0),
  facts jsonb NOT NULL,
  reason text,
  drill_ids uuid[] NOT NULL DEFAULT '{}',
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CONSTRAINT goal_proposals_status_known CHECK (
      status IN ('proposed', 'accepted', 'changed', 'rejected', 'expired')
    ),
  accepted_target numeric(10,3)
    CONSTRAINT goal_proposals_accepted_target_positive CHECK (accepted_target > 0),
  goal_id uuid REFERENCES public.player_goals(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  reject_reason text
    CONSTRAINT goal_proposals_reject_reason_length CHECK (char_length(reject_reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_proposals_once_per_assessment UNIQUE (assessment_id, metric_key),
  CONSTRAINT goal_proposals_decided_has_time CHECK ((status = 'proposed') = (decided_at IS NULL)),
  CONSTRAINT goal_proposals_accepted_has_target CHECK (
    (status IN ('accepted', 'changed')) = (accepted_target IS NOT NULL)
  ),
  CONSTRAINT goal_proposals_reason_only_when_rejected CHECK (status = 'rejected' OR reject_reason IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS goal_proposals_one_open_per_metric
  ON public.goal_proposals (trainee_id, metric_key) WHERE status = 'proposed';
CREATE INDEX IF NOT EXISTS goal_proposals_trainee_idx ON public.goal_proposals (trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS goal_proposals_status_idx ON public.goal_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS goal_proposals_branch_ids_idx ON public.goal_proposals USING gin (branch_ids);
CREATE INDEX IF NOT EXISTS goal_proposals_goal_id_idx ON public.goal_proposals (goal_id);
CREATE INDEX IF NOT EXISTS goal_proposals_decided_by_idx ON public.goal_proposals (decided_by);

COMMENT ON TABLE public.goal_proposals IS
  'Up to 3 Goal proposals (הצעות יעד) per Assessment, waiting for staff to accept, change or reject. Written by the goal-proposals cron and the staff actions with the service role; acceptance through accept_goal_proposal().';
COMMENT ON COLUMN public.goal_proposals.branch_ids IS
  'The Trainee''s Weekly report branches when the proposal was made; staff scope filters on it.';
COMMENT ON COLUMN public.goal_proposals.facts IS
  'The candidate exactly as the model saw it: metric, unit, direction, value, benchmark, standing, step, target, basis and the offered drills.';
COMMENT ON COLUMN public.goal_proposals.problems IS
  'Array of {code, text}: what the guardrails removed from the model''s answer (a dropped reason, a drill that was not offered).';
COMMENT ON COLUMN public.goal_proposals.status IS
  'proposed, accepted (as proposed), changed (accepted with a staff target), rejected, expired (superseded, too old, the metric got a Goal, or the Assessment was deleted).';

DROP TRIGGER IF EXISTS goal_proposals_updated_at ON public.goal_proposals;
CREATE TRIGGER goal_proposals_updated_at
  BEFORE UPDATE ON public.goal_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- Which Assessments the job has looked at
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_proposal_checks (
  assessment_id uuid PRIMARY KEY REFERENCES public.player_assessments(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome text NOT NULL
    CONSTRAINT goal_proposal_checks_outcome_known CHECK (
      outcome IN ('proposed', 'no_candidates', 'none_picked', 'unfinished')
    ),
  attempts smallint NOT NULL DEFAULT 1
    CONSTRAINT goal_proposal_checks_attempts_range CHECK (attempts BETWEEN 1 AND 10),
  model text,
  prompt_version text,
  usage jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_proposal_checks_trainee_idx ON public.goal_proposal_checks (trainee_id);

COMMENT ON TABLE public.goal_proposal_checks IS
  'One row per Assessment the goal-proposals cron claimed. checked_at is the last claim. unfinished: claimed, or the run failed; retried on a later night up to 3 attempts. no_candidates and none_picked are looked at again when the Assessment changed after checked_at; proposed is final. Written by the cron with the service role.';

-- ---------------------------------------------------------------------------
-- Accepting: the Goal and the proposal together, or nothing
-- ---------------------------------------------------------------------------

-- The proposal must still be open and unchanged since the screen read it
-- (proposal_changed; a NULL version never matches); its Assessment must not
-- be soft-deleted (assessment_deleted); its Trainee must be a live trainee
-- (not_a_trainee). A second open Goal on the metric fails on
-- idx_player_goals_unique_active (23505). The caller has already run
-- goalRefusal() on the target.
CREATE OR REPLACE FUNCTION public.accept_goal_proposal(
  p_proposal_id uuid,
  p_expected_updated_at timestamptz,
  p_target numeric,
  p_is_lower_better boolean,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row goal_proposals%ROWTYPE;
  v_goal uuid;
BEGIN
  SELECT * INTO v_row FROM goal_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF v_row.status <> 'proposed' OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'proposal_changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM player_assessments WHERE id = v_row.assessment_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'assessment_deleted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_row.trainee_id AND role = 'trainee' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_a_trainee';
  END IF;

  INSERT INTO player_goals (user_id, metric_key, target_value, baseline_value, is_lower_better, created_by)
    VALUES (v_row.trainee_id, v_row.metric_key, p_target, v_row.baseline_value, p_is_lower_better, p_actor)
    RETURNING id INTO v_goal;

  UPDATE goal_proposals
    SET status = CASE WHEN p_target = v_row.target_value THEN 'accepted' ELSE 'changed' END,
        accepted_target = p_target,
        goal_id = v_goal,
        decided_by = p_actor,
        decided_at = now()
    WHERE id = p_proposal_id;

  RETURN v_goal;
END $function$;

REVOKE ALL ON FUNCTION public.accept_goal_proposal(uuid, timestamptz, numeric, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_goal_proposal(uuid, timestamptz, numeric, boolean, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Lockdown
-- ---------------------------------------------------------------------------

ALTER TABLE public.book_parameter_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_proposal_checks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.book_parameter_metrics FROM anon, authenticated;
REVOKE ALL ON public.goal_proposals FROM anon, authenticated;
REVOKE ALL ON public.goal_proposal_checks FROM anon, authenticated;
