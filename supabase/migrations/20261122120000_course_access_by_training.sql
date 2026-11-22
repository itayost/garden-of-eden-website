-- Course access by training: the course opens for trainees who train now.
-- course_seen_training_on is the last day the nightly sweep saw the trainee
-- training (Arbox check-in or a counted Plan session); course_access_until is
-- a staff mark that opens the course through that day. Both are written only
-- by server code with the service role.

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.profiles
  ADD COLUMN course_seen_training_on date,
  ADD COLUMN course_access_until date;

-- One row per nightly sweep that read Arbox well; the latest row anchors the
-- grace period. Server code only: RLS on, no policies, no grants.
CREATE TABLE public.course_access_sweeps (
  swept_on date PRIMARY KEY,
  arbox_ids integer NOT NULL,
  plan_trainees integer NOT NULL,
  stamped integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_access_sweeps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_access_sweeps FROM anon, authenticated;

-- Same function as 20261116085729 plus the two course checks. Production's
-- definition could not be read when this was written (db:schema failed), so
-- the newest migration file is the source.
CREATE OR REPLACE FUNCTION public.enforce_profile_column_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by its owner';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active cannot be changed by its owner';
  END IF;
  IF NEW.nutrition_appointment_status IS DISTINCT FROM OLD.nutrition_appointment_status THEN
    RAISE EXCEPTION 'nutrition_appointment_status cannot be changed by its owner';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'deleted_at cannot be changed by its owner';
  END IF;
  IF NEW.arbox_user_id IS DISTINCT FROM OLD.arbox_user_id THEN
    RAISE EXCEPTION 'arbox_user_id cannot be changed by its owner';
  END IF;
  IF NEW.arbox_paid_training IS DISTINCT FROM OLD.arbox_paid_training THEN
    RAISE EXCEPTION 'arbox_paid_training cannot be changed by its owner';
  END IF;
  IF NEW.arbox_bought_course IS DISTINCT FROM OLD.arbox_bought_course THEN
    RAISE EXCEPTION 'arbox_bought_course cannot be changed by its owner';
  END IF;
  IF NEW.access_override IS DISTINCT FROM OLD.access_override THEN
    RAISE EXCEPTION 'access_override cannot be changed by its owner';
  END IF;
  IF NEW.branches_set_by_admin_at IS DISTINCT FROM OLD.branches_set_by_admin_at THEN
    RAISE EXCEPTION 'branches_set_by_admin_at cannot be changed by its owner';
  END IF;
  -- The login phone decides which account a paid order lands on (fulfillment
  -- matches by phone), so only staff may move it.
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'phone cannot be changed by its owner';
  END IF;
  -- Who gets billed and what the parent consented to are the parent's
  -- decisions, recorded on the signed agreement; the child cannot move them.
  IF NEW.guardian_name IS DISTINCT FROM OLD.guardian_name THEN
    RAISE EXCEPTION 'guardian_name cannot be changed by its owner';
  END IF;
  IF NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone THEN
    RAISE EXCEPTION 'guardian_phone cannot be changed by its owner';
  END IF;
  IF NEW.medical_notes IS DISTINCT FROM OLD.medical_notes THEN
    RAISE EXCEPTION 'medical_notes cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name THEN
    RAISE EXCEPTION 'emergency_contact_name cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone THEN
    RAISE EXCEPTION 'emergency_contact_phone cannot be changed by its owner';
  END IF;
  IF NEW.photo_consent IS DISTINCT FROM OLD.photo_consent THEN
    RAISE EXCEPTION 'photo_consent cannot be changed by its owner';
  END IF;

  -- Which group a trainee is ranked and rated in is a staff decision.
  IF NEW.age_group_override IS DISTINCT FROM OLD.age_group_override THEN
    RAISE EXCEPTION 'age_group_override cannot be changed by its owner';
  END IF;
  IF NEW.age_group_override_until IS DISTINCT FROM OLD.age_group_override_until THEN
    RAISE EXCEPTION 'age_group_override_until cannot be changed by its owner';
  END IF;

  -- The A mark (cleared to train with an older birth year) is a staff call.
  IF NEW.plays_up IS DISTINCT FROM OLD.plays_up THEN
    RAISE EXCEPTION 'plays_up cannot be changed by its owner';
  END IF;

  -- Weekly report inputs (20261116083744). Gender changes only through staff;
  -- the parent phone card's answers go through server actions that check them
  -- (age for "over 18", now() for "not now"), never straight from the browser.
  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'gender cannot be changed by its owner';
  END IF;
  IF NEW.guardian_not_needed IS DISTINCT FROM OLD.guardian_not_needed THEN
    RAISE EXCEPTION 'guardian_not_needed cannot be changed by its owner';
  END IF;
  IF NEW.guardian_prompt_dismissed_at IS DISTINCT FROM OLD.guardian_prompt_dismissed_at THEN
    RAISE EXCEPTION 'guardian_prompt_dismissed_at cannot be changed by its owner';
  END IF;

  -- Course access (20261122120000). The training-seen day and the staff mark
  -- decide who may open the course, so only server code moves them.
  IF NEW.course_seen_training_on IS DISTINCT FROM OLD.course_seen_training_on THEN
    RAISE EXCEPTION 'course_seen_training_on cannot be changed by its owner';
  END IF;
  IF NEW.course_access_until IS DISTINCT FROM OLD.course_access_until THEN
    RAISE EXCEPTION 'course_access_until cannot be changed by its owner';
  END IF;

  RETURN NEW;
END;
$function$;


-- The staff mark is logged.
ALTER TABLE public.activity_logs DROP CONSTRAINT activity_logs_action_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_action_check CHECK (action = ANY (ARRAY[
  'user_created', 'user_updated', 'user_activated', 'user_deactivated', 'user_deleted',
  'bulk_users_created', 'role_changed', 'profile_updated', 'avatar_updated', 'avatar_cleared',
  'stats_created', 'stats_updated', 'assessment_created', 'assessment_updated', 'assessment_deleted',
  'shift_change_request_created', 'shift_change_request_approved', 'shift_change_request_rejected',
  'shift_change_request_cancelled', 'access_override_changed',
  'measurement_created', 'measurement_updated', 'measurement_deleted',
  'plan_granted', 'invoice_issued',
  'plan_voided', 'plan_cancelled', 'plan_ended_early', 'payment_link_created',
  'slot_called_off', 'slot_called_off_cleared', 'age_group_override_changed',
  'plays_up_changed', 'course_access_mark_changed'
]::text[]));
