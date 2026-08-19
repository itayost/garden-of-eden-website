-- supabase/migrations/20260819150000_activity_log_access_override.sql
-- Allow the access-override action in activity_logs.
--
-- Granting or revoking a customer's access to the app is exactly the change
-- support later needs to attribute, and without this the insert is rejected by
-- activity_logs_action_check and the change goes unrecorded.
--
-- Several action values already written by the app are also missing from the
-- constraint, so they are added here too rather than left to fail silently:
-- avatar_updated, avatar_cleared, assessment_deleted, user_deleted and
-- bulk_users_created all appear in src/lib/actions/.

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check CHECK (action IN (
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
  'access_override_changed'
));
