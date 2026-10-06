-- Six actions the app writes were never added to activity_logs_action_check,
-- so every one of those inserts has been refused since its feature shipped:
-- plan_voided, plan_cancelled, plan_ended_early, payment_link_created,
-- slot_called_off, age_group_override_changed. Most callers only log the
-- error, so the audit record was lost; Early end treats its record as
-- required, so it always failed and rolled back.
--
-- Expand only: the existing list is kept, the six are added.

SET LOCAL lock_timeout = '3s';
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
  'slot_called_off', 'age_group_override_changed'
]::text[])) NOT VALID;
ALTER TABLE public.activity_logs VALIDATE CONSTRAINT activity_logs_action_check;
