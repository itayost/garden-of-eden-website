-- Security fixes from the 2026-10-04 payments review.
--
-- 1. Trainees could read every other trainee's full profile row (medical
--    notes, parent and emergency phones) through a dashboard-created policy
--    that no migration owns. Rankings, the one trainee screen that needs other
--    trainees, now reads its columns with the service role, so the policy goes.
--    Deploy the code before applying this migration, or rankings empties.
-- 2. A trainee could change their own phone. Fulfillment matches a paid order
--    to an account by phone, so phone joins the owner-guarded columns.
-- 3. Online checkout never set signed_at, so online agreements were stored
--    unsigned: the parent was asked to sign again, and anyone with the link
--    could overwrite what they gave. Checkout now sets it; this backfills the
--    agreements already stored, using the time the parent submitted the form.

DROP POLICY IF EXISTS "Trainees can view trainee profiles" ON public.profiles;

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

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(a.id ORDER BY a.created_at), '{}')
    INTO v_ids
    FROM public.enrollment_agreements a
    JOIN public.orders o ON o.id = a.order_id
   WHERE a.signed_at IS NULL
     AND o.payment_provider IN ('morning', 'isracard')
     AND a.declares_healthy AND a.accepts_terms AND a.authorizes_payment
     AND a.signature_name <> '' AND a.parent_id_number <> '';

  -- The prior value of every row touched is NULL; these ids are the undo list.
  RAISE NOTICE 'backfilling signed_at on % online agreements: %', cardinality(v_ids), v_ids;

  UPDATE public.enrollment_agreements
     SET signed_at = created_at
   WHERE id = ANY (v_ids);
END $$;
