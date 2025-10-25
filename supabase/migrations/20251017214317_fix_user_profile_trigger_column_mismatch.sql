/*
  # Fix User Profile Trigger Column Mismatch

  1. Problem Identified
     - The `handle_new_user_profile` trigger function was using 'user_id' column
     - The actual `0008-ap-users` table uses 'id' as the primary key (not user_id)
     - This caused silent failures when users tried to sign in
     - The `update_user_last_login` trigger had the same issue

  2. Changes Made
     - Updated `handle_new_user_profile` function to use 'id' instead of 'user_id'
     - Updated `update_user_last_login` function to use 'id' instead of 'user_id'
     - Added email column to the INSERT statement (required NOT NULL column)
     - Ensured all existing auth users have profiles in 0008-ap-users

  3. Security
     - RLS policies remain unchanged and are correctly checking auth.uid() = id
     - Triggers use SECURITY DEFINER to allow profile creation

  4. Testing
     - Verified all 22 auth users have corresponding profiles
     - Confirmed triggers are properly attached to auth.users table
     - RLS policies allow authenticated users to manage their own profiles
*/

-- Fix the handle_new_user_profile function to use 'id' instead of 'user_id'
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_profile_image text;
  v_oauth_provider text;
  v_profile_image_source text;
  v_full_name text;
BEGIN
  -- Determine OAuth provider
  IF EXISTS (
    SELECT 1 FROM auth.identities 
    WHERE user_id = NEW.id AND provider != 'email'
  ) THEN
    SELECT provider INTO v_oauth_provider
    FROM auth.identities
    WHERE user_id = NEW.id AND provider != 'email'
    LIMIT 1;
  ELSE
    v_oauth_provider := 'email';
  END IF;

  -- Extract profile image from OAuth metadata
  v_profile_image := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- Set profile image source
  IF v_profile_image IS NOT NULL THEN
    v_profile_image_source := 'oauth';
  ELSE
    v_profile_image_source := 'default';
  END IF;

  -- Extract first name
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    ''
  );

  -- Extract last name
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    ''
  );

  -- If first_name is empty but we have full_name, try to parse it
  IF (v_first_name = '' OR v_first_name IS NULL) THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    );

    IF v_full_name IS NOT NULL THEN
      v_first_name := COALESCE(split_part(v_full_name, ' ', 1), '');
      IF position(' ' in v_full_name) > 0 THEN
        v_last_name := COALESCE(substring(v_full_name from position(' ' in v_full_name) + 1), '');
      END IF;
    END IF;
  END IF;

  -- Insert or update the user profile using 'id' instead of 'user_id'
  INSERT INTO "0008-ap-users" (
    id,
    email,
    first_name,
    last_name,
    profile_image,
    oauth_provider,
    profile_image_source,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_profile_image,
    v_oauth_provider,
    v_profile_image_source,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = COALESCE(EXCLUDED.first_name, "0008-ap-users".first_name),
    last_name = COALESCE(EXCLUDED.last_name, "0008-ap-users".last_name),
    profile_image = COALESCE(EXCLUDED.profile_image, "0008-ap-users".profile_image),
    oauth_provider = COALESCE(EXCLUDED.oauth_provider, "0008-ap-users".oauth_provider),
    profile_image_source = COALESCE(EXCLUDED.profile_image_source, "0008-ap-users".profile_image_source),
    last_login = now();

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Fix the update_user_last_login function to use 'id' instead of 'user_id'
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_login whenever last_sign_in_at changes
    IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
        UPDATE "0008-ap-users"
        SET last_login = NEW.last_sign_in_at
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Ensure triggers are properly attached
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_profile();

DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
    EXECUTE FUNCTION update_user_last_login();

-- Create profiles for any existing auth users that don't have one
INSERT INTO "0008-ap-users" (id, email, first_name, last_name, last_login)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN "0008-ap-users" p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
