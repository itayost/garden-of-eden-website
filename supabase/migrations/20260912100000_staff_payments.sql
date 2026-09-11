-- Manual payments taken by staff: how, with what reference, and by whom.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer', 'bit', 'card')),
  ADD COLUMN IF NOT EXISTS reference TEXT CHECK (reference IS NULL OR char_length(reference) <= 60),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Staff enter only what the parent cannot fill in later; the parent adds
-- the birthdate when signing.
ALTER TABLE public.orders ALTER COLUMN child_birthdate DROP NOT NULL;

-- Agreements may now wait for the parent's signature. Until signed the
-- declarations are false and the signature empty; signing is one-way.
ALTER TABLE public.enrollment_agreements
  ALTER COLUMN signed_at DROP NOT NULL,
  ALTER COLUMN signed_at DROP DEFAULT,
  ALTER COLUMN child_birthdate DROP NOT NULL,
  ALTER COLUMN signature_name SET DEFAULT '',
  ALTER COLUMN parent_id_number SET DEFAULT '',
  ALTER COLUMN emergency_contact_name SET DEFAULT '',
  ALTER COLUMN emergency_contact_phone SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS sign_reminded_at TIMESTAMPTZ;
ALTER TABLE public.enrollment_agreements DROP CONSTRAINT IF EXISTS agreement_declarations_true;
ALTER TABLE public.enrollment_agreements
  ADD CONSTRAINT agreement_signed_means_declared
  CHECK (
    signed_at IS NULL
    OR (declares_healthy AND accepts_terms AND authorizes_payment
        AND signature_name <> '' AND parent_id_number <> '')
  );
CREATE INDEX IF NOT EXISTS idx_enrollment_agreements_unsigned
  ON public.enrollment_agreements (profile_id) WHERE signed_at IS NULL;

-- Existing rows were all signed at insert; nothing to backfill.

-- Activity log: the staff payment events, plus the nutrition measurement
-- events the code already writes but the constraint never allowed.
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_action_check CHECK (action IN (
  'user_created',
  'user_updated',
  'user_activated',
  'user_deactivated',
  'user_deleted',
  'bulk_users_created',
  'role_changed',
  'profile_updated',
  'avatar_updated',
  'avatar_cleared',
  'stats_created',
  'stats_updated',
  'assessment_created',
  'assessment_updated',
  'assessment_deleted',
  'shift_change_request_created',
  'shift_change_request_approved',
  'shift_change_request_rejected',
  'shift_change_request_cancelled',
  'access_override_changed',
  'measurement_created',
  'measurement_updated',
  'measurement_deleted',
  'plan_granted',
  'invoice_issued'
));
