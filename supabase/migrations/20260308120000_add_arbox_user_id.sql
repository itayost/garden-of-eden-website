-- Add Arbox user_id to profiles for cross-system linking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS arbox_user_id INTEGER UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_arbox_user_id ON profiles(arbox_user_id);
