-- Adds the seven actions the app writes but the check never listed (each
-- insert was refused). The new list is a superset of the old one.

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
  'slot_called_off', 'slot_called_off_cleared', 'age_group_override_changed'
]::text[]));
