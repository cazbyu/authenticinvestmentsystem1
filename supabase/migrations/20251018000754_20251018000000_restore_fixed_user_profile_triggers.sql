/*
  # Restore Fixed User Profile Triggers with Enhanced Error Handling
  
  ## Problem Analysis
  The trigger functions were previously disabled because they caused 500 errors during auth.
  Root causes identified:
  1. RLS policies blocking SECURITY DEFINER functions during auth flow
  2. Missing error handling causing unhandled exceptions
  3. Potential race conditions during user creation
  
  ## Solution
  1. Restore the working trigger logic from migration 20251017214317
  2. Add comprehensive error handling with TRY/CATCH blocks
  3. Add explicit SET LOCAL role to bypass RLS safely
  4. Add logging for debugging without breaking auth
  
  ## Changes
  - `handle_new_user_profile()`: Creates/updates profile on user signup
  - `update_user_last_login()`: Updates last_login timestamp on signin
  - Both functions use SECURITY DEFINER with explicit role setting
  - Comprehensive error handling prevents auth failures
  
  ## Security
  - Functions use SECURITY DEFINER to bypass RLS (necessary for auth flow)
  - Only operate on the user's own record (NEW.id)
  - No privilege escalation possible
  - RLS still enforced for normal application queries
*/

-- Drop and recreate handle_new_user_profile with error handling
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_profile_image text;
  v_oauth_provider text;
  v_profile_image_source text;
  v_full_name text;
  v_oauth_provider_id text;
BEGIN
  -- Explicitly set role to bypass RLS during trigger execution
  PERFORM set_config('role', 'postgres', true);
  
  BEGIN
    -- Determine OAuth provider
    IF EXISTS (
      SELECT 1 FROM auth.identities 
      WHERE user_id = NEW.id AND provider != 'email'
    ) THEN
      SELECT provider, id INTO v_oauth_provider, v_oauth_provider_id
      FROM auth.identities
      WHERE user_id = NEW.id AND provider != 'email'
      LIMIT 1;
    ELSE
      v_oauth_provider := 'email';
      v_oauth_provider_id := NULL;
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

    -- Insert or update the user profile
    INSERT INTO "0008-ap-users" (
      id,
      email,
      first_name,
      last_name,
      profile_image,
      oauth_provider,
      oauth_provider_id,
      profile_image_source,
      last_login
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      v_first_name,
      v_last_name,
      v_profile_image,
      v_oauth_provider,
      v_oauth_provider_id,
      v_profile_image_source,
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = COALESCE(EXCLUDED.email, "0008-ap-users".email),
      first_name = COALESCE(EXCLUDED.first_name, "0008-ap-users".first_name),
      last_name = COALESCE(EXCLUDED.last_name, "0008-ap-users".last_name),
      profile_image = COALESCE(EXCLUDED.profile_image, "0008-ap-users".profile_image),
      oauth_provider = COALESCE(EXCLUDED.oauth_provider, "0008-ap-users".oauth_provider),
      oauth_provider_id = COALESCE(EXCLUDED.oauth_provider_id, "0008-ap-users".oauth_provider_id),
      profile_image_source = COALESCE(EXCLUDED.profile_image_source, "0008-ap-users".profile_image_source),
      last_login = now(),
      updated_at = now();

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth - critical for preventing 500 errors
    RAISE WARNING 'Error in handle_new_user_profile for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate update_user_last_login with error handling
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Explicitly set role to bypass RLS during trigger execution
  PERFORM set_config('role', 'postgres', true);
  
  BEGIN
    -- Update last_login whenever last_sign_in_at changes
    IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
      UPDATE "0008-ap-users"
      SET 
        last_login = NEW.last_sign_in_at,
        updated_at = now()
      WHERE id = NEW.id;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth - critical for preventing 500 errors
    RAISE WARNING 'Error in update_user_last_login for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Backfill any missing profiles for existing auth users
INSERT INTO "0008-ap-users" (id, email, first_name, last_name, last_login, oauth_provider)
SELECT 
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  u.last_sign_in_at,
  COALESCE(
    (SELECT provider FROM auth.identities WHERE user_id = u.id AND provider != 'email' LIMIT 1),
    'email'
  )
FROM auth.users u
LEFT JOIN "0008-ap-users" p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
