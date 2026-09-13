-- Keep application-owned phone columns canonical while allowing Supabase Auth
-- to retain its provider-specific bare 972 representation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_phone text;
BEGIN
  normalized_phone := CASE
    WHEN NEW.phone IS NULL THEN NULL
    WHEN NEW.phone ~ '^\+972[0-9]{9}$' THEN NEW.phone
    WHEN NEW.phone ~ '^972[0-9]{9}$' THEN '+' || NEW.phone
    WHEN NEW.phone ~ '^0[0-9]{9}$' THEN '+972' || substring(NEW.phone FROM 2)
    ELSE NEW.phone
  END;

  INSERT INTO public.profiles (id, phone, role)
  VALUES (NEW.id, normalized_phone, 'trainee');

  RETURN NEW;
END;
$$;

-- Existing profiles came from three sources and therefore use +972..., 972...,
-- or 05.... A preflight check confirmed there are no semantic collisions.
UPDATE public.profiles
SET phone = CASE
  WHEN phone ~ '^972[0-9]{9}$' THEN '+' || phone
  WHEN phone ~ '^0[0-9]{9}$' THEN '+972' || substring(phone FROM 2)
  ELSE phone
END
WHERE phone ~ '^972[0-9]{9}$'
   OR phone ~ '^0[0-9]{9}$';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_e164_check
    CHECK (phone IS NULL OR phone ~ '^\+972[0-9]{9}$'),
  ADD CONSTRAINT profiles_guardian_phone_e164_check
    CHECK (guardian_phone IS NULL OR guardian_phone ~ '^\+972[0-9]{9}$'),
  ADD CONSTRAINT profiles_emergency_contact_phone_e164_check
    CHECK (
      emergency_contact_phone IS NULL
      OR emergency_contact_phone ~ '^\+972[0-9]{9}$'
    );

ALTER TABLE public.branches
  ADD CONSTRAINT branches_manager_phone_e164_check
    CHECK (manager_phone IS NULL OR manager_phone ~ '^\+972[0-9]{9}$');

ALTER TABLE public.enrollment_agreements
  ADD CONSTRAINT enrollment_agreements_parent_phone_e164_check
    CHECK (parent_phone ~ '^\+972[0-9]{9}$'),
  ADD CONSTRAINT enrollment_agreements_emergency_phone_e164_check
    CHECK (
      emergency_contact_phone = ''
      OR emergency_contact_phone ~ '^\+972[0-9]{9}$'
    );

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payer_phone_e164_check
    CHECK (payer_phone ~ '^\+972[0-9]{9}$'),
  ADD CONSTRAINT orders_login_phone_e164_check
    CHECK (login_phone ~ '^\+972[0-9]{9}$');

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payer_phone_e164_check
    CHECK (payer_phone ~ '^\+972[0-9]{9}$');
