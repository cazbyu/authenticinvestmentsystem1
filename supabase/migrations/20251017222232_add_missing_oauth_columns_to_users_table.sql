/*
  # Add Missing OAuth Columns to Users Table
  
  ## Problem
  The `handle_new_user_profile` trigger function references columns that don't exist:
  - `oauth_provider` - tracks authentication provider (google, email, etc)
  - `profile_image_source` - tracks source of profile image (oauth, custom, default)
  - `oauth_provider_id` - provider's unique user identifier
  
  This causes the trigger to fail when users sign up or log in, preventing
  profile creation and blocking authentication.
  
  ## Solution
  Add the missing columns that the trigger expects to exist.
  
  ## Security
  - No RLS changes needed - inherits existing policies
  - Columns are informational only, no sensitive data
*/

-- Add oauth_provider column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider text DEFAULT 'email';
    CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON "0008-ap-users"(oauth_provider);
  END IF;
END $$;

-- Add oauth_provider_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'oauth_provider_id'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN oauth_provider_id text;
    CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON "0008-ap-users"(oauth_provider_id);
  END IF;
END $$;

-- Add profile_image_source column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'profile_image_source'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN profile_image_source text DEFAULT 'default';
  END IF;
END $$;

-- Backfill oauth_provider for existing users based on auth.identities
UPDATE "0008-ap-users" u
SET oauth_provider = COALESCE(
  (SELECT provider FROM auth.identities WHERE user_id = u.id AND provider != 'email' LIMIT 1),
  'email'
)
WHERE oauth_provider IS NULL OR oauth_provider = 'email';

-- Backfill profile_image_source for existing users
UPDATE "0008-ap-users"
SET profile_image_source = CASE
  WHEN profile_image IS NOT NULL THEN 'custom'
  ELSE 'default'
END
WHERE profile_image_source IS NULL;
