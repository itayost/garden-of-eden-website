-- The A mark: staff clear a trainee to train with an older birth year
-- (שנתון מעל), and the calendar shows an "A" by his name. Set from the
-- trainee page by an Admin, or a trainer for a trainee in their branch,
-- through setPlaysUp() in src/lib/actions/admin-plays-up.ts.

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.profiles
  ADD COLUMN plays_up boolean NOT NULL DEFAULT false;

-- ===========================================
-- Trainees cannot set the mark on themselves
-- ===========================================
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

  RETURN NEW;
END;
$function$;

-- ===========================================
-- The change is logged like the age group
-- ===========================================
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
  'plays_up_changed'
]::text[]));
