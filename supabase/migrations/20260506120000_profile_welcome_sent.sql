-- Track WhatsApp welcome message delivery per profile.
-- NULL means "needs to be sent"; a timestamp means "already sent".
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcome_message_sent_at TIMESTAMPTZ;

-- New-users-only policy: stamp every existing profile so they will not be
-- retroactively messaged. Future Arbox imports land with NULL and are picked
-- up by the welcome hook in the nightly sync.
UPDATE profiles
   SET welcome_message_sent_at = created_at
 WHERE welcome_message_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_welcome_pending_idx
  ON profiles (created_at)
  WHERE welcome_message_sent_at IS NULL;
