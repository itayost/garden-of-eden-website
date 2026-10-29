-- Surveys, spec docs/superpowers/specs/2026-10-29-surveys-design.md.
--
-- Expand only: seven new tables and two functions. Apply this BEFORE
-- deploying the code, which reads and writes them; the code running today
-- never touches them. Needs set_row_updated_at() from 20260911120000 and reads
-- profile_branches.
--
-- Every table is read and written only by server actions with the service
-- role: RLS is on with no policies, and anon and authenticated have no
-- grants. A Survey's Questions are replaced as a set by save_survey_draft()
-- (only while it has no Response); a Response and its answers are written
-- together by submit_survey_response().

SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  intro text CHECK (intro IS NULL OR char_length(intro) <= 500),
  opens_on date NOT NULL,
  closes_on date,
  birth_years smallint[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id),
  CONSTRAINT surveys_dates CHECK (closes_on IS NULL OR closes_on >= opens_on),
  CONSTRAINT surveys_closed_after_published CHECK (closed_at IS NULL OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.survey_branches (
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  PRIMARY KEY (survey_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 19),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['single_choice'::text, 'multi_choice'::text, 'rating'::text, 'text'::text])),
  prompt text NOT NULL CHECK (char_length(prompt) <= 300),
  required boolean NOT NULL DEFAULT true,
  low_label text CHECK (low_label IS NULL OR char_length(low_label) <= 40),
  high_label text CHECK (high_label IS NULL OR char_length(high_label) <= 40),
  UNIQUE (survey_id, position),
  CONSTRAINT survey_questions_labels_only_on_rating CHECK (kind = 'rating' OR (low_label IS NULL AND high_label IS NULL))
);

CREATE TABLE IF NOT EXISTS public.survey_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  label text NOT NULL CHECK (char_length(label) <= 100),
  UNIQUE (question_id, position),
  -- The target of survey_answers' composite foreign key, so an answer's
  -- option must belong to the answer's own Question.
  CONSTRAINT survey_question_options_question_id_id_key UNIQUE (question_id, id)
);

CREATE TABLE IF NOT EXISTS public.survey_views (
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  branch_ids uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (survey_id, profile_id)
);

-- A Question or option that has answers cannot be deleted on its own (NO
-- ACTION); deleting the whole Survey still removes everything, because its
-- Responses, and so their answers, cascade in the same statement. Both
-- foreign keys to Questions and options are deferred to the end of the
-- transaction on purpose: the Survey's cascades fire in trigger-name order,
-- and a plain NO ACTION check made when the Questions cascade ends, before
-- the Responses cascade has run, would refuse the Survey's own deletion.
CREATE TABLE IF NOT EXISTS public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  option_id uuid,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  text_value text CHECK (text_value IS NULL OR char_length(text_value) BETWEEN 1 AND 1000),
  CONSTRAINT survey_answers_one_value CHECK (num_nonnulls(option_id, rating, text_value) = 1),
  -- One answer per rating or text Question, distinct options on a choice
  -- Question (NULL option_ids count as equal).
  CONSTRAINT survey_answers_one_value_per_option UNIQUE NULLS NOT DISTINCT (response_id, question_id, option_id),
  -- MATCH SIMPLE: a NULL option_id (rating or text answer) is not checked.
  CONSTRAINT survey_answers_option_of_question FOREIGN KEY (question_id, option_id)
    REFERENCES public.survey_question_options (question_id, id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

-- The unique keys already lead with survey_id, question_id or response_id;
-- these cover the remaining foreign keys.
CREATE INDEX IF NOT EXISTS survey_branches_branch_id_idx ON public.survey_branches (branch_id);
CREATE INDEX IF NOT EXISTS survey_views_profile_id_idx ON public.survey_views (profile_id);
CREATE INDEX IF NOT EXISTS survey_responses_profile_id_idx ON public.survey_responses (profile_id);
CREATE INDEX IF NOT EXISTS survey_answers_question_id_idx ON public.survey_answers (question_id);
CREATE INDEX IF NOT EXISTS survey_answers_option_id_idx ON public.survey_answers (option_id);
CREATE INDEX IF NOT EXISTS surveys_created_by_idx ON public.surveys (created_by);
CREATE INDEX IF NOT EXISTS surveys_published_by_idx ON public.surveys (published_by);
CREATE INDEX IF NOT EXISTS surveys_closed_by_idx ON public.surveys (closed_by);

DROP TRIGGER IF EXISTS surveys_set_updated_at ON public.surveys;
CREATE TRIGGER surveys_set_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.surveys IS
  'A Survey staff send to an audience of Trainees. Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_branches IS
  'The branches of a Survey''s audience. Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_questions IS
  'The Questions of a Survey, in order. Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_question_options IS
  'The options of a choice Question, in order. Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_views IS
  'The first time a Trainee saw a Survey (Seen). Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_responses IS
  'One Trainee''s sent Response to one Survey, with the branches they belonged to then. Written and read only by server actions with the service role.';
COMMENT ON TABLE public.survey_answers IS
  'The answers of a Response: one row per chosen option, or one rating, or one text. Written and read only by server actions with the service role.';

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.surveys FROM anon, authenticated;
REVOKE ALL ON public.survey_branches FROM anon, authenticated;
REVOKE ALL ON public.survey_questions FROM anon, authenticated;
REVOKE ALL ON public.survey_question_options FROM anon, authenticated;
REVOKE ALL ON public.survey_views FROM anon, authenticated;
REVOKE ALL ON public.survey_responses FROM anon, authenticated;
REVOKE ALL ON public.survey_answers FROM anon, authenticated;

-- Saves a draft: creates the Survey, or replaces an existing one's columns,
-- branches, Questions and options in one step (all or nothing). The row lock
-- serialises it with submit_survey_response(), so a Response cannot land
-- while the Questions are being swapped. p_questions is an array of
-- {kind, prompt, required, low_label, high_label, options: [label, ...]},
-- stored in array order. Labels are kept only on rating Questions (trimmed,
-- an empty one as NULL).
CREATE OR REPLACE FUNCTION public.save_survey_draft(
  p_survey_id uuid,
  p_actor uuid,
  p_title text,
  p_intro text,
  p_opens_on date,
  p_closes_on date,
  p_birth_years smallint[],
  p_branch_ids uuid[],
  p_questions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_survey_id IS NULL THEN
    INSERT INTO surveys (title, intro, opens_on, closes_on, birth_years, created_by)
      VALUES (p_title, p_intro, p_opens_on, p_closes_on, COALESCE(p_birth_years, '{}'), p_actor)
      RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM surveys WHERE id = p_survey_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'survey_not_found'; END IF;
    IF EXISTS (SELECT 1 FROM survey_responses WHERE survey_id = p_survey_id) THEN
      RAISE EXCEPTION 'survey_has_responses';
    END IF;

    v_id := p_survey_id;
    UPDATE surveys
      SET title = p_title,
          intro = p_intro,
          opens_on = p_opens_on,
          closes_on = p_closes_on,
          birth_years = COALESCE(p_birth_years, '{}')
      WHERE id = v_id;
    DELETE FROM survey_branches WHERE survey_id = v_id;
    DELETE FROM survey_questions WHERE survey_id = v_id;
  END IF;

  INSERT INTO survey_branches (survey_id, branch_id)
    SELECT DISTINCT v_id, b FROM unnest(p_branch_ids) AS b;

  -- Every Question and every option in one statement: the Question ids are
  -- generated up front so the options can name their Question.
  WITH q AS MATERIALIZED (
    SELECT gen_random_uuid() AS id, e.ordinality - 1 AS position, e.value AS def
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS e(value, ordinality)
  ), new_questions AS (
    INSERT INTO survey_questions (id, survey_id, position, kind, prompt, required, low_label, high_label)
      SELECT q.id,
             v_id,
             q.position,
             q.def->>'kind',
             q.def->>'prompt',
             COALESCE((q.def->>'required')::boolean, true),
             CASE WHEN q.def->>'kind' = 'rating' THEN NULLIF(btrim(q.def->>'low_label'), '') END,
             CASE WHEN q.def->>'kind' = 'rating' THEN NULLIF(btrim(q.def->>'high_label'), '') END
      FROM q
  )
  INSERT INTO survey_question_options (question_id, position, label)
    SELECT q.id, o.ordinality - 1, o.label
    FROM q
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(q.def->'options') = 'array' THEN q.def->'options' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS o(label, ordinality);

  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.save_survey_draft(uuid, uuid, text, text, date, date, smallint[], uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_survey_draft(uuid, uuid, text, text, date, date, smallint[], uuid[], jsonb) TO service_role;

-- Writes a Trainee's Response and its answers together, or nothing. Judged
-- here, under the Survey's shared row lock (which keeps a concurrent
-- save_survey_draft() from swapping the Questions underneath):
--   * the Survey is published, not closed, and today in Israel is inside
--     opens_on .. closes_on (survey_not_open);
--   * the Trainee belongs to a branch of the Survey (not_in_audience); the
--     Response keeps those branches as its snapshot, computed here and never
--     taken from the caller;
--   * every answer is to a Question of this Survey and has the value its
--     Question kind takes: an option on a choice Question (one at most on a
--     single choice), a rating on a rating Question, text on a text Question
--     (survey_changed). That an option belongs to its answer's own Question is
--     the table's job (foreign key survey_answers_option_of_question: an
--     option of another Question fails with 23503 when the transaction
--     commits, and the whole call is rolled back).
-- Access tier, is_active, birth year and required Questions are the action's
-- (answersProblem and the audience rules); this is the last line.
-- p_answers is an array of {question_id, option_id, rating, text}.
CREATE OR REPLACE FUNCTION public.submit_survey_response(
  p_survey_id uuid,
  p_profile_id uuid,
  p_answers jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_published_at timestamptz;
  v_closed_at timestamptz;
  v_opens_on date;
  v_closes_on date;
  v_today date := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_branch_ids uuid[];
  v_response_id uuid;
BEGIN
  SELECT published_at, closed_at, opens_on, closes_on
    INTO v_published_at, v_closed_at, v_opens_on, v_closes_on
    FROM surveys WHERE id = p_survey_id FOR SHARE;
  IF NOT FOUND
     OR v_published_at IS NULL
     OR v_closed_at IS NOT NULL
     OR v_today NOT BETWEEN v_opens_on AND COALESCE(v_closes_on, 'infinity'::date) THEN
    RAISE EXCEPTION 'survey_not_open';
  END IF;

  SELECT COALESCE(array_agg(pb.branch_id ORDER BY pb.branch_id), '{}'::uuid[]) INTO v_branch_ids
    FROM profile_branches pb
    JOIN survey_branches sb ON sb.branch_id = pb.branch_id AND sb.survey_id = p_survey_id
    WHERE pb.profile_id = p_profile_id;
  IF cardinality(v_branch_ids) = 0 THEN RAISE EXCEPTION 'not_in_audience'; END IF;

  IF EXISTS (
    WITH a AS (
      SELECT x.question_id, x.option_id, x.rating, x.text, q.id AS known_question_id, q.kind
      FROM jsonb_to_recordset(p_answers) AS x(question_id uuid, option_id uuid, rating smallint, text text)
      LEFT JOIN survey_questions q ON q.id = x.question_id AND q.survey_id = p_survey_id
    )
    SELECT 1 FROM a
    WHERE a.known_question_id IS NULL
       OR (a.option_id IS NOT NULL AND a.kind NOT IN ('single_choice', 'multi_choice'))
       OR (a.rating IS NOT NULL AND a.kind <> 'rating')
       OR (a.text IS NOT NULL AND a.kind <> 'text')
    UNION ALL
    SELECT 1 FROM a
    WHERE a.kind = 'single_choice' AND a.option_id IS NOT NULL
    GROUP BY a.question_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'survey_changed';
  END IF;

  INSERT INTO survey_responses (survey_id, profile_id, branch_ids)
    VALUES (p_survey_id, p_profile_id, v_branch_ids)
    ON CONFLICT (survey_id, profile_id) DO NOTHING
    RETURNING id INTO v_response_id;
  IF v_response_id IS NULL THEN RAISE EXCEPTION 'already_answered'; END IF;

  INSERT INTO survey_answers (response_id, question_id, option_id, rating, text_value)
    SELECT v_response_id, a.question_id, a.option_id, a.rating, a.text
    FROM jsonb_to_recordset(p_answers) AS a(question_id uuid, option_id uuid, rating smallint, text text);

  -- Answering counts as Seen even if the popup's own Seen call never landed.
  INSERT INTO survey_views (survey_id, profile_id)
    VALUES (p_survey_id, p_profile_id)
    ON CONFLICT DO NOTHING;

  RETURN v_response_id;
END $function$;

REVOKE ALL ON FUNCTION public.submit_survey_response(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(uuid, uuid, jsonb) TO service_role;
