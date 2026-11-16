-- Weekly report inputs, spec docs/superpowers/specs/2026-11-11-weekly-report-design.md
-- (plan docs/superpowers/plans/2026-11-15-weekly-report-inputs.md).
--
-- Expand only: new nullable or defaulted columns on profiles and orders, and
-- three new tables. Apply this BEFORE deploying the code, which reads and
-- writes them; the code running today never touches them. Safe to rerun.
-- Needs set_row_updated_at() (20260911120000) and update_user_streak() (006).
--
-- The three tables are read and written only by server code with the service
-- role: RLS is on with no policies, and anon and authenticated have no grants.

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text
    CONSTRAINT profiles_gender_known CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS guardian_not_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_prompt_dismissed_at timestamptz;

COMMENT ON COLUMN public.profiles.gender IS
  'male or female: how Hebrew text addresses the Trainee. Filled when empty by /join, the signing page and the Arbox sync; changed only by staff.';
COMMENT ON COLUMN public.profiles.guardian_not_needed IS
  'The Trainee answered "אני מעל 18" on the dashboard: no parent phone is asked for.';
COMMENT ON COLUMN public.profiles.guardian_prompt_dismissed_at IS
  'Last "לא עכשיו" on the dashboard parent phone card; the card returns 7 days later.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS child_gender text
    CONSTRAINT orders_child_gender_known CHECK (child_gender IN ('male', 'female'));

COMMENT ON COLUMN public.orders.child_gender IS
  'The gender typed on /join; fulfillment copies it to the profile when the profile has none.';

CREATE TABLE IF NOT EXISTS public.trainee_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  sleep_hours numeric(3,1) NOT NULL
    CONSTRAINT trainee_checkins_sleep_range CHECK (
      sleep_hours >= 3 AND sleep_hours <= 12 AND sleep_hours * 2 = floor(sleep_hours * 2)
    ),
  energy smallint NOT NULL CONSTRAINT trainee_checkins_energy_range CHECK (energy BETWEEN 1 AND 5),
  soreness boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainee_checkins_one_per_day UNIQUE (trainee_id, checkin_date)
);

COMMENT ON TABLE public.trainee_checkins IS
  'A Trainee''s daily Check-in (sleep, energy, soreness), one per Israel day. Written by saveCheckinAction with the service role.';

CREATE TABLE IF NOT EXISTS public.slot_trainee_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag text NOT NULL CONSTRAINT slot_trainee_tags_known CHECK (tag IN (
    'effort', 'progress', 'focus', 'leadership', 'technique', 'personal_best', 'pain', 'behavior'
  )),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_trainee_tags_once UNIQUE (slot_id, trainee_id, tag)
);

COMMENT ON TABLE public.slot_trainee_tags IS
  'Quick tags a Trainer tapped for a Trainee after a Slot. Written by toggleQuickTagAction with the service role.';

CREATE TABLE IF NOT EXISTS public.slot_trainee_notes (
  slot_id uuid NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL CONSTRAINT slot_trainee_notes_length CHECK (char_length(note) BETWEEN 1 AND 80),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_id, trainee_id)
);

COMMENT ON TABLE public.slot_trainee_notes IS
  'The one short Quick tag note per Trainee per Slot. Written by saveQuickTagNoteAction with the service role.';

CREATE INDEX IF NOT EXISTS trainee_checkins_trainee_idx ON public.trainee_checkins (trainee_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS slot_trainee_tags_trainee_idx ON public.slot_trainee_tags (trainee_id);
CREATE INDEX IF NOT EXISTS slot_trainee_tags_created_by_idx ON public.slot_trainee_tags (created_by);
CREATE INDEX IF NOT EXISTS slot_trainee_notes_trainee_idx ON public.slot_trainee_notes (trainee_id);
CREATE INDEX IF NOT EXISTS slot_trainee_notes_updated_by_idx ON public.slot_trainee_notes (updated_by);

DROP TRIGGER IF EXISTS trainee_checkins_set_updated_at ON public.trainee_checkins;
CREATE TRIGGER trainee_checkins_set_updated_at
  BEFORE UPDATE ON public.trainee_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- A Check-in counts toward the streak like the forms do (006). Insert only: a
-- second answer the same day is an update and must not count twice.
CREATE OR REPLACE FUNCTION public.trigger_streak_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM update_user_streak(NEW.trainee_id, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streak_after_checkin_insert ON public.trainee_checkins;
CREATE TRIGGER streak_after_checkin_insert
  AFTER INSERT ON public.trainee_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trigger_streak_checkin();

ALTER TABLE public.trainee_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_trainee_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_trainee_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trainee_checkins FROM anon, authenticated;
REVOKE ALL ON public.slot_trainee_tags FROM anon, authenticated;
REVOKE ALL ON public.slot_trainee_notes FROM anon, authenticated;
